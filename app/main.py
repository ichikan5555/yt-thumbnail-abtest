"""CLI entry point for YouTube Thumbnail A/B Testing."""

import signal
import sys
import time

import click
from rich.console import Console
from rich.table import Table

from app import setup_logging
from app.config import settings
from app.database import get_session, init_db
from app.models import ABTest, Measurement, TestStatus, Variant

console = Console()


@click.group()
def cli():
    """YouTube Thumbnail A/B Testing Tool"""
    setup_logging(settings.log_level)
    init_db()


@cli.command()
def auth():
    """Authenticate with YouTube (opens browser)."""
    from app.services.youtube_api import youtube_api

    if not settings.google_client_id or not settings.google_client_secret:
        console.print(
            "[red]Error:[/red] Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"
        )
        sys.exit(1)

    console.print("Opening browser for YouTube OAuth2 authentication...")
    youtube_api.authenticate_interactive()
    console.print("[green]Authentication successful![/green]")


@cli.command()
@click.argument("video_id")
@click.argument("thumbnails", nargs=3, type=click.Path(exists=True))
def start(video_id: str, thumbnails: tuple[str, ...]):
    """Start A/B test: VIDEO_ID THUMB_A THUMB_B THUMB_C"""
    from app.services.notifier import notifier
    from app.services.scheduler import rotation_scheduler
    from app.services.state_machine import state_machine
    from app.services.youtube_api import youtube_api

    # Check quota
    estimated_quota = (settings.cycles * settings.num_variants + 1) * 51
    if not youtube_api.check_quota_available(estimated_quota):
        console.print(f"[red]Insufficient API quota. Need ~{estimated_quota} units.[/red]")
        sys.exit(1)

    # Get video info
    console.print(f"Fetching video info for {video_id}...")
    try:
        info = youtube_api.get_video_info(video_id)
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)

    console.print(f"  Title: {info['title']}")
    console.print(f"  Views: {info['view_count']:,}")

    # Create test
    test = state_machine.create_test(video_id, list(thumbnails), info["title"])
    test = state_machine.start_test(test.id)

    console.print(f"\n[green]Test #{test.id} started![/green]")
    console.print(f"  Cycles: {settings.cycles}")
    console.print(f"  Interval: {settings.rotation_interval_minutes} min")
    total_min = settings.cycles * settings.num_variants * settings.rotation_interval_minutes
    console.print(f"  Estimated duration: {total_min} min ({total_min / 60:.1f} hours)")

    # Notify
    notifier.notify_test_start(test.id, video_id, info["title"])

    # Start scheduler and run
    rotation_scheduler.start()
    rotation_scheduler.schedule_test(test.id)

    console.print("\nRunning... Press Ctrl+C to stop (test continues in DB).")
    _wait_for_interrupt()


@cli.command()
@click.argument("test_id", type=int)
def status(test_id: int):
    """Show test status."""
    session = get_session()
    try:
        test = session.get(ABTest, test_id)
        if not test:
            console.print(f"[red]Test #{test_id} not found[/red]")
            return

        table = Table(title=f"Test #{test.id}")
        table.add_column("Field", style="bold")
        table.add_column("Value")

        table.add_row("Video ID", test.video_id)
        table.add_row("Title", test.video_title)
        table.add_row("Status", _status_style(test.status))
        table.add_row("Cycle", f"{test.current_cycle + 1}/{test.cycles}")
        table.add_row("Created", str(test.created_at))
        if test.started_at:
            table.add_row("Started", str(test.started_at))
        if test.completed_at:
            table.add_row("Completed", str(test.completed_at))
        if test.error_message:
            table.add_row("Error", test.error_message)

        console.print(table)

        # Variants
        variants = session.query(Variant).filter_by(ab_test_id=test_id).all()
        vt = Table(title="Variants")
        vt.add_column("Label")
        vt.add_column("Avg Velocity")
        vt.add_column("Measurements")
        vt.add_column("Image")
        for v in variants:
            winner = " *" if test.winner_variant_id == v.id else ""
            vt.add_row(
                f"{v.label}{winner}",
                f"{v.avg_velocity:.1f} views/h",
                str(v.measurement_count),
                v.image_path,
            )
        console.print(vt)
    finally:
        session.close()


@cli.command("list")
def list_tests():
    """List all tests."""
    session = get_session()
    try:
        tests = session.query(ABTest).order_by(ABTest.id.desc()).limit(20).all()
        if not tests:
            console.print("No tests found.")
            return

        table = Table(title="A/B Tests")
        table.add_column("ID", style="bold")
        table.add_column("Video")
        table.add_column("Status")
        table.add_column("Cycle")
        table.add_column("Winner")
        table.add_column("Created")

        for t in tests:
            winner_label = ""
            if t.winner_variant_id:
                w = session.get(Variant, t.winner_variant_id)
                winner_label = w.label if w else ""

            table.add_row(
                str(t.id),
                f"{t.video_title[:40]}" if t.video_title else t.video_id,
                _status_style(t.status),
                f"{t.current_cycle + 1}/{t.cycles}",
                winner_label,
                str(t.created_at)[:16],
            )
        console.print(table)
    finally:
        session.close()


@cli.command()
@click.argument("test_id", type=int)
def pause(test_id: int):
    """Pause a running test."""
    from app.services.state_machine import state_machine

    try:
        state_machine.pause_test(test_id)
        console.print(f"[yellow]Test #{test_id} paused.[/yellow]")
    except ValueError as e:
        console.print(f"[red]{e}[/red]")


@cli.command()
@click.argument("test_id", type=int)
def resume(test_id: int):
    """Resume a paused test."""
    from app.services.scheduler import rotation_scheduler
    from app.services.state_machine import state_machine

    try:
        state_machine.resume_test(test_id)
        rotation_scheduler.start()
        rotation_scheduler.schedule_test(test_id)
        console.print(f"[green]Test #{test_id} resumed.[/green]")
        _wait_for_interrupt()
    except ValueError as e:
        console.print(f"[red]{e}[/red]")


@cli.command()
@click.argument("test_id", type=int)
def cancel(test_id: int):
    """Cancel a test."""
    from app.services.state_machine import state_machine

    try:
        state_machine.cancel_test(test_id)
        console.print(f"[red]Test #{test_id} cancelled.[/red]")
    except ValueError as e:
        console.print(f"[red]{e}[/red]")


@cli.command()
@click.argument("test_id", type=int)
def results(test_id: int):
    """Show detailed test results."""
    session = get_session()
    try:
        test = session.get(ABTest, test_id)
        if not test:
            console.print(f"[red]Test #{test_id} not found[/red]")
            return

        if test.status != TestStatus.COMPLETED:
            console.print(f"[yellow]Test #{test_id} is {test.status.value} (not completed)[/yellow]")

        from app.services.analyzer import analyzer

        result = analyzer.determine_winner(test_id)

        console.print(f"\n[bold]Test #{test_id} Results[/bold]")
        console.print(f"Video: {result.video_title}")
        console.print()

        table = Table()
        table.add_column("Variant", style="bold")
        table.add_column("Avg Velocity", justify="right")
        table.add_column("Measurements", justify="right")
        table.add_column("Total Views", justify="right")
        table.add_column("Improvement", justify="right")
        table.add_column("")

        for v in result.variants:
            marker = "[green bold]WINNER[/green bold]" if v.is_winner else ""
            pct = f"+{v.improvement_pct:.1f}%" if v.improvement_pct > 0 else "-"
            table.add_row(
                v.label,
                f"{v.avg_velocity:.1f} views/h",
                str(v.measurement_count),
                f"+{v.total_views_gained:,}",
                pct,
                marker,
            )
        console.print(table)

        # Show individual measurements
        measurements = (
            session.query(Measurement)
            .filter_by(ab_test_id=test_id)
            .filter(Measurement.velocity.isnot(None))
            .order_by(Measurement.cycle, Measurement.started_at)
            .all()
        )
        if measurements:
            console.print("\n[bold]Measurements[/bold]")
            mt = Table()
            mt.add_column("Cycle")
            mt.add_column("Variant")
            mt.add_column("Start Views", justify="right")
            mt.add_column("End Views", justify="right")
            mt.add_column("Duration", justify="right")
            mt.add_column("Velocity", justify="right")

            for m in measurements:
                v = session.get(Variant, m.variant_id)
                mt.add_row(
                    str(m.cycle + 1),
                    v.label,
                    f"{m.view_count_start:,}",
                    f"{m.view_count_end:,}" if m.view_count_end else "-",
                    f"{m.duration_minutes:.0f} min" if m.duration_minutes else "-",
                    f"{m.velocity:.1f} v/h" if m.velocity else "-",
                )
            console.print(mt)
    finally:
        session.close()


@cli.command()
def quota():
    """Show today's API quota usage."""
    from app.services.youtube_api import youtube_api

    used = youtube_api.get_daily_quota_used()
    remaining = settings.daily_quota_limit - used
    pct = used / settings.daily_quota_limit * 100

    console.print(f"[bold]API Quota Usage (today)[/bold]")
    console.print(f"  Used:      {used:,} / {settings.daily_quota_limit:,} ({pct:.1f}%)")
    console.print(f"  Remaining: {remaining:,}")
    console.print(f"  Est. tests possible: ~{remaining // 357}")


@cli.command()
def web():
    """Start Web UI server on port 8888."""
    import uvicorn
    from app.api.server import create_app

    app = create_app()
    console.print(f"Starting Web UI on http://{settings.web_host}:{settings.web_port}")
    uvicorn.run(app, host=settings.web_host, port=settings.web_port, log_level="info")


@cli.command()
def daemon():
    """Run as daemon: recover running tests and wait."""
    from app.services.scheduler import rotation_scheduler

    console.print("Starting daemon mode...")
    rotation_scheduler.start()

    count = rotation_scheduler.recover_running_tests()
    if count:
        console.print(f"[green]Recovered {count} running test(s).[/green]")
    else:
        console.print("No running tests to recover.")

    console.print("Daemon running. Press Ctrl+C to stop.")
    _wait_for_interrupt()


def _wait_for_interrupt():
    """Block until SIGINT/SIGTERM."""

    def _handler(sig, frame):
        console.print("\nShutting down...")
        from app.services.scheduler import rotation_scheduler

        rotation_scheduler.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, _handler)
    signal.signal(signal.SIGTERM, _handler)

    while True:
        time.sleep(1)


def _status_style(s: TestStatus) -> str:
    styles = {
        TestStatus.PENDING: "[dim]pending[/dim]",
        TestStatus.RUNNING: "[green]running[/green]",
        TestStatus.PAUSED: "[yellow]paused[/yellow]",
        TestStatus.COMPLETED: "[blue]completed[/blue]",
        TestStatus.CANCELLED: "[red]cancelled[/red]",
        TestStatus.ERROR: "[red bold]error[/red bold]",
    }
    return styles.get(s, str(s))


if __name__ == "__main__":
    cli()
