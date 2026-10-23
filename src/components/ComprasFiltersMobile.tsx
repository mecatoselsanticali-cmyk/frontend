import { Package, Plus, User, type LucideIcon } from "lucide-react";
import DateRangeFilterMobile, { type DateRange } from "./DateRangeFilterMobile";

interface FilterOption { _id: string; name: string }
interface ComprasFiltersMobileProps extends DateRange {
  productId: string;
  registeredBy: string;
  products: FilterOption[];
  users: FilterOption[];
  onRangeChange: (range: DateRange) => void;
  onProductChange: (value: string) => void;
  onUserChange: (value: string) => void;
  onCreate: () => void;
  onClear: () => void;
}

function MobileFilterSelect({ label, icon: Icon, value, options, onChange }: {
  label: string; icon: LucideIcon; value: string; options: FilterOption[]; onChange: (value: string) => void;
}) {
  return <label className="flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-zinc-400 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20"><Icon size={17} className="shrink-0" aria-hidden="true" /><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 w-full bg-white text-sm text-zinc-700 focus:outline-none"><option value="">{label}: todos</option>{options.map((option) => <option key={option._id} value={option._id}>{option.name}</option>)}</select></label>;
}

export default function ComprasFiltersMobile(props: ComprasFiltersMobileProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200/80 bg-white p-4 md:hidden">
      <DateRangeFilterMobile from={props.from} to={props.to} onChange={props.onRangeChange} />
      <MobileFilterSelect label="Producto" icon={Package} value={props.productId} options={props.products} onChange={props.onProductChange} />
      <MobileFilterSelect label="Usuario" icon={User} value={props.registeredBy} options={props.users} onChange={props.onUserChange} />
      <button type="button" onClick={props.onCreate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-sm font-medium text-white shadow-sm transition-transform hover:bg-orange-700 active:scale-[0.99] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"><Plus size={17} aria-hidden="true" />Nueva compra</button>
      {(props.from || props.to || props.productId || props.registeredBy) && <button type="button" onClick={props.onClear} className="w-full rounded-lg py-1 text-xs font-medium text-zinc-500 hover:text-orange-600">Limpiar filtros</button>}
    </div>
  );
}
