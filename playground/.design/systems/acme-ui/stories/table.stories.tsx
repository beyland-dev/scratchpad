import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function Invoices() {
  return (
    <Table className="w-[480px]">
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">INV-1042</TableCell>
          <TableCell><Badge>Paid</Badge></TableCell>
          <TableCell className="text-right">$1,250.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">INV-1043</TableCell>
          <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
          <TableCell className="text-right">$640.00</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
