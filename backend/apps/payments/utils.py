from django.template.loader import render_to_string
from weasyprint import HTML, CSS
from django.conf import settings
import os

def render_pdf(template, context):
   html_string = render_to_string(template, context)

   css_path = os.path.join(settings.BASE_DIR, "app/pdf/styles/invoice.css")

   return HTML(
      string=html_string,
      base_url=settings.BASE_DIR  # IMPORTANT for static files
   ).write_pdf(
      stylesheets=[CSS(filename=css_path)]
   )