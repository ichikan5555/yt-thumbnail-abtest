"""FastAPI application factory with lifespan, CORS, and static files."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import setup_logging
from app.config import settings, BASE_DIR
from app.database import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, start scheduler, recover running tests."""
    setup_logging(settings.log_level)
    init_db()

    from app.services.scheduler import rotation_scheduler
    rotation_scheduler.start()

    count = rotation_scheduler.recover_running_tests()
    if count:
        logger.info("Recovered %d running test(s)", count)

    logger.info("Web server started on %s:%d", settings.web_host, settings.web_port)
    yield

    # Shutdown
    from app.services.scheduler import rotation_scheduler
    rotation_scheduler.stop()
    logger.info("Web server stopped")


def create_app() -> FastAPI:
    app = FastAPI(
        title="YouTube Thumbnail A/B Test",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS for dev (Vite on 5173)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    from app.api.routers.tests import router as tests_router
    from app.api.routers.quota import router as quota_router
    from app.api.routers.events import router as events_router
    from app.api.routers.settings import router as settings_router
    from app.api.routers.auth import router as auth_router
    from app.api.routers.contact import router as contact_router

    from app.api.routers.cross_analysis import router as cross_analysis_router
    from app.api.routers.competitor import router as competitor_router
    from app.api.routers.backup import router as backup_router
    from app.api.routers.templates import router as templates_router
    from app.api.routers.report import router as report_router

    app.include_router(tests_router)
    app.include_router(quota_router)
    app.include_router(events_router)
    app.include_router(settings_router)
    app.include_router(auth_router)
    app.include_router(contact_router)
    app.include_router(cross_analysis_router)
    app.include_router(competitor_router)
    app.include_router(backup_router)
    app.include_router(templates_router)
    app.include_router(report_router)

    # Serve uploaded thumbnails
    thumb_dir = settings.thumbnail_upload_dir
    thumb_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/thumbnails", StaticFiles(directory=str(thumb_dir)), name="thumbnails")

    # Serve frontend build if it exists (SPA catch-all)
    dist_dir = BASE_DIR / "frontend" / "dist"
    if dist_dir.is_dir():
        from starlette.responses import FileResponse
        import mimetypes

        async def _serve_spa(path: str):
            if path:
                file_path = dist_dir / path
                if file_path.is_file():
                    content_type = mimetypes.guess_type(str(file_path))[0]
                    return FileResponse(str(file_path), media_type=content_type)
            return FileResponse(str(dist_dir / "index.html"))

        @app.get("/")
        async def spa_root():
            return await _serve_spa("")

        @app.get("/{path:path}")
        async def spa_catchall(path: str):
            return await _serve_spa(path)

    return app
