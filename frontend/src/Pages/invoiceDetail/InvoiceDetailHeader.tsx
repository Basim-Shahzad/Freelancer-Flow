interface Props {
   invoice_number: string | undefined;
}

export default function InvoiceDetailHeader({ invoice_number }: Props) {
   return (
      <div className="flex sm:flex-row sm:justify-between px-4 lg:px-8">
         <h1 className="text-2xl font-semibold lg:text-display-xs">{invoice_number}</h1>
      </div>
   );
}