from sqlalchemy import func, select
from sqlalchemy.orm import column_property

from .User import User
from .ClientProfile import ClientProfile
from .Project import Project
from .RefreshToken import RefreshToken
from .TimeEntry import TimeEntry
from .Milestone import Milestone
from .MilestoneApproval import MilestoneApproval
from .FreelancerProfile import FreelancerProfile
from .PortalAccessToken import PortalAccessToken
from .Invoice import Invoice
from .invoice_item import InvoiceItem
from .Payment import Payment
from .InvoiceEvent import InvoiceEvent
from .Expense import Expense
from .VatRemittance import VatRemittance
from .ChangeRequest import ChangeRequest
from .ActivityEvent import ActivityEvent

# Derived, never stored: total tracked minutes per project (replaces the old
# `Project.total_time_spent` column, which duplicated this SUM and drifted).
# Attached here rather than in Project.py to avoid a Project <-> TimeEntry
# import cycle.
Project.total_time_spent_minutes = column_property(
    select(func.coalesce(func.sum(TimeEntry.duration_minutes), 0))
    .where(TimeEntry.project_id == Project.id)
    .correlate_except(TimeEntry)
    .scalar_subquery()
)
