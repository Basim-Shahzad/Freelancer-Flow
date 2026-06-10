from django.core.management.base import BaseCommand
from django.utils import timezone
from faker import Faker
from apps.clients.models import Client
from apps.projects.models import Project
from apps.time_tracking.models import TimeEntry
from apps.invoices.models import Invoice, InvoiceItem
from apps.invoices.services import mark_invoice_paid
from django.contrib.auth import get_user_model
import random
from decimal import Decimal

fake = Faker()
User = get_user_model()

ADMIN_USER_UUID = "b219e12d-881b-43ca-85a3-f231b9dabe77"


class Command(BaseCommand):
    help = "Seed DB with randomized data within the last 365 days"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete existing seeded data before re-seeding",
        )

    def handle(self, *args, **options):
        try:
            user_instance = User.objects.get(id=ADMIN_USER_UUID)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR("Admin user not found."))
            return

        if options["flush"]:
            self.stdout.write("Flushing existing data...")
            InvoiceItem.objects.filter(invoice__user=user_instance).delete()
            Invoice.objects.filter(user=user_instance).delete()
            TimeEntry.objects.filter(user=user_instance).delete()
            Project.objects.filter(user=user_instance).delete()
            Client.objects.filter(user=user_instance).delete()
            self.stdout.write(self.style.WARNING("Existing data deleted."))

        # 1. Clients
        for _ in range(100):
            client = Client(
                user=user_instance,
                name=fake.company(),
                email=fake.unique.email(),
                phone=fake.phone_number(),
            )
            client.save()
            Client.objects.filter(pk=client.pk).update(
                created_at=timezone.now()
                - timezone.timedelta(days=random.randint(300, 365))
            )

        clients = list(Client.objects.filter(user=user_instance))

        if not clients:
            self.stdout.write(self.style.ERROR("No clients were created. Aborting."))
            return

        # 2. Projects
        for _ in range(150):
            created_at = timezone.now() - timezone.timedelta(
                days=random.randint(100, 300)
            )
            due_at = created_at + timezone.timedelta(days=random.randint(30, 90))

            h_rate = None
            f_rate = None
            if random.random() > 0.5:
                h_rate = Decimal(random.randint(20, 150))
            else:
                f_rate = Decimal(random.randint(500, 5000))

            project = Project(
                user=user_instance,
                client=random.choice(clients),
                name=f"Project {fake.word().capitalize()}",
                description=fake.sentence(),
                status=random.choice(["active", "completed", "archived"]),
                due_date=due_at,
                hourly_rate=h_rate,
                fixed_rate=f_rate,
            )
            project.save()
            Project.objects.filter(pk=project.pk).update(created_at=created_at)

        projects = list(Project.objects.filter(user=user_instance))

        if not projects:
            self.stdout.write(self.style.ERROR("No projects were created. Aborting."))
            return

        # 3. Time Entries
        for _ in range(750):
            proj = random.choice(projects)
            proj.refresh_from_db()
            days_ago = random.randint(0, (timezone.now() - proj.created_at).days or 1)
            start = timezone.now() - timezone.timedelta(
                days=days_ago, hours=random.randint(1, 12)
            )

            TimeEntry.objects.create(
                user=user_instance,
                project=proj,
                description=fake.sentence(),
                start_time=start,
                end_time=start + timezone.timedelta(hours=random.randint(1, 5)),
            )

        # 4. Invoices & Items
        for _ in range(200):
            selected_project = random.choice(projects)
            selected_project.refresh_from_db()
            selected_client = selected_project.client

            project_age_days = (
                timezone.now().date() - selected_project.created_at.date()
            )
            max_days_back = min(150, project_age_days.days or 1)
            issue_date = (
                timezone.now()
                - timezone.timedelta(days=random.randint(1, max_days_back))
            ).date()
            due_date = issue_date + timezone.timedelta(days=14)

            status = random.choice(["draft", "sent", "paid", "overdue", "cancelled"])
            payment_date = None
            if status == "paid":
                payment_date = issue_date + timezone.timedelta(
                    days=random.randint(0, 10)
                )

            invoice = Invoice.objects.create(
                user=user_instance,
                client=selected_client,
                project=selected_project,
                issue_date=issue_date,
                due_date=due_date,
                status="draft" if status == "paid" else status,
                notes=fake.sentence(),
                tax_rate=Decimal("5.00") if random.random() > 0.8 else Decimal("0.00"),
            )

            for _ in range(random.randint(1, 4)):
                if selected_project.hourly_rate:
                    qty = Decimal(random.randint(60, 600))
                    price = selected_project.hourly_rate
                else:
                    qty = Decimal("1.00")
                    price = Decimal(random.randint(100, 1000))

                InvoiceItem.objects.create(
                    invoice=invoice,
                    description=fake.catch_phrase(),
                    quantity=qty,
                    unit_price=price,
                )

            if status == "paid":
                mark_invoice_paid(invoice, payment_date=payment_date)

            invoice.refresh_from_db()
            invoice.tax_amount = invoice.tax_amount.quantize(Decimal("0.01"))
            invoice.total = invoice.total.quantize(Decimal("0.01"))
            invoice.save()

        self.stdout.write(
            self.style.SUCCESS("✅ Success: All data randomized within 365 days.")
        )
