"""Autorização centralizada.

Regras-chave:
- Negação por padrão.
- 4 camadas de decisão: perfil, produto/equipe, vínculo com o registro, concessões vigentes.
- Nunca aceita `organization_id` do cliente; usa a sessão do usuário atual.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from functools import wraps
from typing import Callable, Iterable

from flask import g
from flask_login import current_user

from .errors import BusinessError
from .time import now_utc


@dataclass(frozen=True)
class AccessContext:
    user_id: str
    organization_id: str
    role: str
    product_ids: frozenset[str]
    grants: frozenset[str]


def load_context() -> AccessContext:
    user = current_user
    if not user or not user.is_authenticated:
        raise BusinessError("unauthorized", "Autenticação necessária", status=401)
    if not user.is_active:
        raise BusinessError("forbidden", "Usuário inativo", status=403)

    # Cache por request
    ctx: AccessContext | None = getattr(g, "access_context", None)
    if ctx is not None:
        return ctx

    from ..modules.users.models import PermissionGrant

    now = now_utc()
    product_ids = frozenset(str(p.id) for p in getattr(user, "products", []) or [])
    grants = frozenset(
        g_.permission
        for g_ in PermissionGrant.active_for_user(user.id, now)
    )
    ctx = AccessContext(
        user_id=str(user.id),
        organization_id=str(user.organization_id),
        role=user.role,
        product_ids=product_ids,
        grants=grants,
    )
    g.access_context = ctx
    return ctx


def has_role(*roles: str) -> bool:
    try:
        ctx = load_context()
    except BusinessError:
        return False
    return ctx.role in roles


def has_grant(name: str) -> bool:
    try:
        ctx = load_context()
    except BusinessError:
        return False
    return name in ctx.grants


def require(check: Callable[[AccessContext], bool], *, message: str = "Acesso negado"):
    """Decorator para rotas Flask que exige uma condição avaliada sobre o contexto."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            ctx = load_context()
            if not check(ctx):
                raise BusinessError("forbidden", message, status=403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_role(*roles: str):
    return require(lambda ctx: ctx.role in roles, message="Perfil não autorizado")


def require_grant(*grants: str):
    return require(
        lambda ctx: any(g in ctx.grants for g in grants),
        message="Permissão específica necessária",
    )
