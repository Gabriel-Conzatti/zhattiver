from flask import Flask, request
from flask_login import current_user

from ..modules.users.models import ROLE_SINISTROS
from .errors import BusinessError

_CLAIMS_ONLY_PREFIXES = (
    "/api/v1/auth/",
    "/api/v1/claims/",
    "/api/v1/notifications/",
)
_CLAIMS_ONLY_EXACT_PATHS = {
    "/api/v1/health",
    "/api/v1/claims",
    "/api/v1/notifications",
}


def init_role_scope_security(app: Flask) -> None:
    @app.before_request
    def _restrict_claims_only_role() -> None:
        if not current_user.is_authenticated or current_user.role != ROLE_SINISTROS:
            return
        if request.path in _CLAIMS_ONLY_EXACT_PATHS:
            return
        if any(request.path.startswith(prefix) for prefix in _CLAIMS_ONLY_PREFIXES):
            return
        raise BusinessError(
            "forbidden",
            "Perfil autorizado somente para o módulo de sinistros",
            status=403,
        )
