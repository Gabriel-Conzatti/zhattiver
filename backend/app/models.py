"""Importa todos os modelos para garantir que fiquem registrados no metadata.

Adicione novos modelos aqui à medida que novos módulos forem criados.
"""

from .modules.audit.models import AuditLog  # noqa: F401
from .modules.bonus.models import BonusPayment, BonusRule, MonthlyGoal  # noqa: F401
from .modules.calendar.models import Holiday  # noqa: F401
from .modules.catalog.models import (  # noqa: F401
    ClientType,
    Insurer,
    Origin,
    Tag,
    TagCategory,
)
from .modules.cross_sell.models import CrossSellItem, CrossSellList  # noqa: F401
from .modules.funnel.models import Funnel, FunnelStage  # noqa: F401
from .modules.goals.models import DailyProspectingQuota  # noqa: F401
from .modules.imports.models import ImportBatch, ImportRow  # noqa: F401
from .modules.leads.models import (  # noqa: F401
    Availability,
    Lead,
    LeadPhone,
    LeadProduct,
    LeadTag,
    Vehicle,
)
from .modules.management.models import Absence  # noqa: F401
from .modules.notifications.models import Notification  # noqa: F401
from .modules.opportunities.models import (  # noqa: F401
    Activity,
    LossReason,
    NextAction,
    NextActionType,
    Opportunity,
)
from .modules.orgs.models import Organization  # noqa: F401
from .modules.sales.models import Sale, SaleRevision  # noqa: F401
from .modules.schedules.models import Schedule  # noqa: F401
from .modules.users.models import (  # noqa: F401
    PermissionGrant,
    Product,
    Team,
    User,
)

__all__ = [
    "Absence",
    "Activity",
    "AuditLog",
    "Availability",
    "BonusPayment",
    "BonusRule",
    "ClientType",
    "CrossSellItem",
    "CrossSellList",
    "DailyProspectingQuota",
    "Funnel",
    "FunnelStage",
    "Holiday",
    "ImportBatch",
    "ImportRow",
    "Insurer",
    "Lead",
    "LeadPhone",
    "LeadProduct",
    "LeadTag",
    "LossReason",
    "MonthlyGoal",
    "NextAction",
    "NextActionType",
    "Notification",
    "Opportunity",
    "Organization",
    "Origin",
    "PermissionGrant",
    "Product",
    "Sale",
    "SaleRevision",
    "Schedule",
    "Tag",
    "TagCategory",
    "Team",
    "User",
    "Vehicle",
]
