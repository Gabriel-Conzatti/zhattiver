from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab

from .. import create_app

flask_app = create_app(os.getenv("LYNK_ENV", "development"))
celery_app = Celery(
    "lynk",
    broker=flask_app.config["CELERY_BROKER_URL"],
    backend=flask_app.config["CELERY_RESULT_BACKEND"],
)
celery_app.conf.update(
    task_default_queue="lynk",
    timezone=flask_app.config["LYNK_TIMEZONE"],
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
)


class FlaskTask(celery_app.Task):
    abstract = True

    def __call__(self, *args, **kwargs):  # pragma: no cover
        with flask_app.app_context():
            return super().__call__(*args, **kwargs)


celery_app.Task = FlaskTask


# Beat: fechamento diário às 19h local + follow-ups automáticos às 6h.
celery_app.conf.beat_schedule = {
    "close-daily-metas": {
        "task": "app.jobs.tasks.close_daily_metas",
        "schedule": crontab(
            hour=int(flask_app.config.get("LYNK_DAILY_METAS_CLOSE_HOUR", 19)),
            minute=0,
        ),
    },
    "generate-daily-followups": {
        "task": "app.jobs.tasks.generate_daily_followups",
        "schedule": crontab(hour=6, minute=0),
    },
}


from . import tasks  # noqa: F401,E402  ensure tasks are registered
