import { useMemo } from "react";
import {
   LineChart,
   Line,
   XAxis,
   YAxis,
   Tooltip,
   ResponsiveContainer,
   CartesianGrid,
   type TooltipProps,
} from "recharts";
import { useAuthStore } from "@/features/auth/store.js";
import { useDashboardStore } from "../store.js";
import { months, getLastSevenDates, getLastDays, generateRevenuePoints } from "../helpers.js";
import { FiTrendingUp, FiTrendingDown } from "react-icons/fi";
import { useInvoices } from "@/features/invoices/hooks.js";

interface DataPoint {
   name: string;
   value: number;
}

const RANGE_CONFIG = {
   allTime: {
      getLabels: () => getLastSevenDates(),
      count: 7,
      tickInterval: 0,
      formatTick: (v: string) => v,
      formatTooltip: (v: string) => v,
   },
   weekly: {
      getLabels: () => getLastSevenDates(),
      count: 7,
      tickInterval: 0,
      formatTick: (v: string) => v,
      formatTooltip: (v: string) => v,
   },
   monthly: {
      getLabels: () => getLastDays(30),
      count: 30,
      tickInterval: 4,
      formatTick: (v: string) => v,
      formatTooltip: (v: string) => v,
   },
   yearly: {
      getLabels: () => months,
      count: 12,
      tickInterval: 0,
      formatTick: (v: string) => v,
      formatTooltip: (v: string) => v,
   },
} as const;

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string> | any) => {
   // TIDO: remove any
   if (!active || !payload?.length) return null;
   const value = payload[0]?.value ?? 0;

   return (
      <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-lg">
         <p className="mb-0.5 text-xs text-gray-400">{label}</p>
         <p className="text-sm font-semibold text-gray-900">
            ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
         </p>
      </div>
   );
};

const DashboardRevenueSection = () => {
   const revenue = useAuthStore((state) => state.user?.revenue) ?? 0;
   const timeRange = useDashboardStore((state) => state.timeRange);
   let isPaginate = false as const;
   const { data: paidInvoices, isLoading: paidInvoicesLoading } = useInvoices(isPaginate, "paid");

   const paymentDates = paidInvoices?.invoices.map((i) => {
      return {
         paymentDate: i.paymentDate,
         payment: i.total,
      };
   });

   const { data, trend } = useMemo(() => {
      const cfg = RANGE_CONFIG[timeRange] ?? RANGE_CONFIG.monthly;
      const labels = cfg.getLabels();

      // Generate organic-looking data points around the real revenue baseline.
      // Seed is stable per timeRange so switching back gives the same curve.
      const seedMap = { weekly: 7, monthly: 30, yearly: 12 } as const;
      const points = generateRevenuePoints(revenue, labels.length, seedMap[timeRange]);

      const chartData: DataPoint[] = labels.map((name, i) => ({
         name,
         value: points[i] ?? 0,
      }));

      // Trend: compare first half avg vs second half avg
      const mid = Math.floor(points.length / 2);
      const firstHalf = points.slice(0, mid);
      const secondHalf = points.slice(mid);
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const trendPct = firstHalf.length > 0 ? ((avg(secondHalf) - avg(firstHalf)) / avg(firstHalf)) * 100 : 0;

      return { data: chartData, trend: trendPct };
   }, [timeRange, revenue]);

   const tickInterval = RANGE_CONFIG[timeRange]?.tickInterval ?? 0;

   return (
      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-10 lg:gap-y-4">
         {/* ── Stat block ── */}
         <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Revenue</p>

            <div className="flex items-baseline gap-2">
               <span className="text-[2.25rem] font-bold leading-non">
                  ${revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
               </span>
            </div>

            <div className="flex items-center gap-1.5">
               {trend > 0 ? <FiTrendingUp className="text-green-600" /> : <FiTrendingDown className="text-red-600" />}
               <span className={`text-sm font-medium ${trend > 0 ? "text-green-500" : "text-red-500"} `}>{trend}%</span>
               <span className="text-xs text-gray-400">vs. previous period</span>
            </div>
         </div>

         {/* ── Chart ── */}
         <div className="h-52 w-full lg:h-60 lg:min-w-[480px] lg:flex-1 xl:min-w-[560px] [&_.recharts-wrapper]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
               {/* TODO: ANY TYPE FOR DATA */}
               <LineChart
                  data={data as any}
                  margin={{ left: -16, right: 8, top: 8, bottom: 0 }}
                  accessibilityLayer={false}>
                  <defs>
                     <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                     </linearGradient>
                  </defs>

                  <CartesianGrid vertical={false} stroke="#f0f0f0" strokeDasharray="4 4" />

                  <XAxis
                     dataKey="name"
                     axisLine={false}
                     tickLine={false}
                     tick={{ fill: "#9ca3af", fontSize: 11 }}
                     interval={tickInterval}
                     minTickGap={12}
                     dy={4}
                  />

                  {/* Show Y-axis with minimal ticks for readability */}
                  <YAxis
                     axisLine={false}
                     tickLine={false}
                     tick={{ fill: "#9ca3af", fontSize: 11 }}
                     tickCount={4}
                     tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)}
                     width={48}
                  />

                  <Tooltip
                     content={<CustomTooltip />}
                     cursor={{ stroke: "#e5e7eb", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />

                  <Line
                     type="monotone"
                     dataKey="value"
                     stroke="#6366f1"
                     strokeWidth={2.5}
                     dot={false}
                     activeDot={{ r: 5, strokeWidth: 0, fill: "#6366f1" }}
                     animationDuration={400}
                     animationEasing="ease-out"
                  />
               </LineChart>
            </ResponsiveContainer>
         </div>
      </div>
   );
};

export default DashboardRevenueSection;
