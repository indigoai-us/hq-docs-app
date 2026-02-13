import { useMemo, Suspense, lazy } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

// Lazy-load Recharts components only when a chart block is encountered
const LazyBarChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.BarChart }))
);
const LazyLineChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.LineChart }))
);
const LazyAreaChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.AreaChart }))
);
const LazyPieChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.PieChart }))
);
const LazyRadarChart = lazy(() =>
  import("recharts").then((m) => ({ default: m.RadarChart }))
);

// Eagerly import subcomponents (they are small and shared across chart types)
import {
  Bar,
  Line,
  Area,
  Pie,
  Radar,
  Cell,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Chart configuration parsed from a ```chart code block.
 *
 * Supported JSON format:
 * ```chart
 * {
 *   "type": "bar",           // bar | line | area | pie | radar
 *   "title": "Sales by Q",   // optional
 *   "data": [
 *     {"name": "Q1", "value": 100},
 *     {"name": "Q2", "value": 200}
 *   ],
 *   "keys": ["value"],       // optional — data keys to chart (auto-detected if omitted)
 *   "colors": ["#4F46E5"]    // optional — custom colors per key
 * }
 * ```
 *
 * CSV format:
 * ```chart
 * type: bar
 * name,value,count
 * Q1,100,50
 * Q2,200,80
 * Q3,150,60
 * ```
 */

interface ChartConfig {
  type: "bar" | "line" | "area" | "pie" | "radar";
  title?: string;
  data: Record<string, unknown>[];
  keys: string[];
  colors: string[];
  nameKey: string;
}

// Indigo-themed color palette for chart series
const DEFAULT_COLORS = [
  "#4F46E5", // indigo-600
  "#6366f1", // indigo-500
  "#818cf8", // indigo-400
  "#a5b4fc", // indigo-300
  "#c7d2fe", // indigo-200
  "#22d3ee", // cyan-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#f87171", // red-400
  "#a78bfa", // violet-400
];

interface ChartBlockProps {
  /** Raw content from the ```chart code block */
  children: string;
  className?: string;
}

/**
 * Parse CSV text into an array of objects.
 * First line is headers. Numeric values are auto-converted.
 */
function parseCsv(csv: string): Record<string, unknown>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      const val = values[idx] ?? "";
      const num = Number(val);
      row[header] = val !== "" && !isNaN(num) ? num : val;
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse the raw chart block content into a ChartConfig.
 * Supports JSON and CSV formats.
 */
function parseChartConfig(raw: string): ChartConfig {
  const trimmed = raw.trim();

  // Try JSON parse first
  if (trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed) as {
      type?: string;
      title?: string;
      data?: Record<string, unknown>[];
      keys?: string[];
      colors?: string[];
      nameKey?: string;
    };

    if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
      throw new Error("Chart JSON must include a non-empty 'data' array.");
    }

    const type = validateChartType(json.type);
    const nameKey = json.nameKey || detectNameKey(json.data);
    const keys =
      json.keys && json.keys.length > 0
        ? json.keys
        : detectNumericKeys(json.data, nameKey);

    if (keys.length === 0) {
      throw new Error(
        "No numeric data keys found. Provide 'keys' or include numeric values in data."
      );
    }

    return {
      type,
      title: json.title,
      data: json.data,
      keys,
      colors: json.colors || DEFAULT_COLORS.slice(0, keys.length),
      nameKey,
    };
  }

  // CSV format: optional "type: xxx" line, then CSV
  const lines = trimmed.split("\n");
  let type: ChartConfig["type"] = "bar";
  let csvStart = 0;

  // Check for "type: xxx" directive on first line
  const typeMatch = lines[0].match(/^type:\s*(\w+)/i);
  if (typeMatch) {
    type = validateChartType(typeMatch[1]);
    csvStart = 1;
  }

  // Check for "title: xxx" directive
  let title: string | undefined;
  if (lines[csvStart] && /^title:\s*/i.test(lines[csvStart])) {
    title = lines[csvStart].replace(/^title:\s*/i, "").trim();
    csvStart++;
  }

  const csvText = lines.slice(csvStart).join("\n");
  const data = parseCsv(csvText);

  if (data.length === 0) {
    throw new Error("No data rows found in CSV.");
  }

  const nameKey = detectNameKey(data);
  const keys = detectNumericKeys(data, nameKey);

  if (keys.length === 0) {
    throw new Error(
      "No numeric data columns found in CSV. Ensure at least one column has numeric values."
    );
  }

  return {
    type,
    title,
    data,
    keys,
    colors: DEFAULT_COLORS.slice(0, keys.length),
    nameKey,
  };
}

function validateChartType(type?: string): ChartConfig["type"] {
  const valid = ["bar", "line", "area", "pie", "radar"];
  if (type && valid.includes(type.toLowerCase())) {
    return type.toLowerCase() as ChartConfig["type"];
  }
  return "bar";
}

/**
 * Detect the name/label key from data — typically the first string-valued key.
 */
function detectNameKey(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "name";
  const first = data[0];
  // Prefer "name" or "label" if they exist
  if ("name" in first) return "name";
  if ("label" in first) return "label";
  // Otherwise first string-valued key
  for (const key of Object.keys(first)) {
    if (typeof first[key] === "string") return key;
  }
  return Object.keys(first)[0] || "name";
}

/**
 * Detect numeric keys (those that have numeric values in first row), excluding nameKey.
 */
function detectNumericKeys(
  data: Record<string, unknown>[],
  nameKey: string
): string[] {
  if (data.length === 0) return [];
  const first = data[0];
  return Object.keys(first).filter(
    (k) => k !== nameKey && typeof first[k] === "number"
  );
}

/** Custom tooltip styled for glass aesthetic */
function GlassTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-black/80 px-3 py-2 shadow-xl backdrop-blur-xl">
      {label != null && (
        <p className="mb-1 text-xs font-medium text-white/60">{label}</p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-white/50">{entry.name}:</span>
          <span className="font-medium text-white/90">
            {typeof entry.value === "number"
              ? entry.value.toLocaleString()
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Custom legend styled for glass aesthetic */
function GlassLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>;
}) {
  if (!payload?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap justify-center gap-4">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-white/50">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders a chart from a ```chart code block.
 * Supports bar, line, area, pie, and radar charts with JSON and CSV data formats.
 * Glass-compatible dark styling with Indigo accents.
 */
function ChartBlockInner({ children, className }: ChartBlockProps) {
  const { config, error } = useMemo(() => {
    try {
      return { config: parseChartConfig(children), error: null };
    } catch (err) {
      return {
        config: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [children]);

  // Error fallback: show raw data + error message
  if (error || !config) {
    return (
      <div
        className={cn(
          "my-4 rounded-lg border border-amber-500/20 bg-amber-950/10",
          className
        )}
      >
        <div className="flex items-center gap-2 border-b border-amber-500/20 px-4 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span className="text-xs text-amber-400">Chart rendering error</span>
        </div>
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
          <code className="font-mono text-white/70">{children}</code>
        </pre>
        {error && (
          <div className="border-t border-amber-500/10 px-4 py-2">
            <p className="text-xs text-amber-400/60">{error}</p>
          </div>
        )}
      </div>
    );
  }

  const { type, title, data, keys, colors, nameKey } = config;

  // Common axis styling
  const axisStyle = {
    fontSize: 11,
    fill: "rgba(255,255,255,0.4)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  };

  const gridStroke = "rgba(255,255,255,0.05)";

  return (
    <div
      className={cn(
        "my-4 rounded-lg border border-white/5 bg-black/30 p-4",
        className
      )}
    >
      {title && (
        <h4 className="mb-3 text-center text-sm font-medium text-white/60">
          {title}
        </h4>
      )}

      <ResponsiveContainer width="100%" height={300}>
        {type === "pie" ? (
          <LazyPieChart>
            <Pie
              data={data}
              dataKey={keys[0]}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={40}
              strokeWidth={1}
              stroke="rgba(0,0,0,0.3)"
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={{ stroke: "rgba(255,255,255,0.2)" }}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Pie>
            <Tooltip
              content={<GlassTooltip />}
            />
            <Legend
              content={<GlassLegend />}
            />
          </LazyPieChart>
        ) : type === "radar" ? (
          <LazyRadarChart data={data} cx="50%" cy="50%" outerRadius={100}>
            <PolarGrid stroke={gridStroke} />
            <PolarAngleAxis dataKey={nameKey} tick={axisStyle} />
            <PolarRadiusAxis tick={axisStyle} />
            {keys.map((key, i) => (
              <Radar
                key={key}
                name={key}
                dataKey={key}
                stroke={colors[i % colors.length]}
                fill={colors[i % colors.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Tooltip
              content={<GlassTooltip />}
            />
            <Legend
              content={<GlassLegend />}
            />
          </LazyRadarChart>
        ) : type === "line" ? (
          <LazyLineChart data={data}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} tick={axisStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <Tooltip
              content={<GlassTooltip />}
            />
            <Legend
              content={<GlassLegend />}
            />
            {keys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[i % colors.length], r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </LazyLineChart>
        ) : type === "area" ? (
          <LazyAreaChart data={data}>
            <defs>
              {keys.map((key, i) => (
                <linearGradient
                  key={key}
                  id={`area-gradient-${key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={colors[i % colors.length]}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={colors[i % colors.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} tick={axisStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <Tooltip
              content={<GlassTooltip />}
            />
            <Legend
              content={<GlassLegend />}
            />
            {keys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i % colors.length]}
                fill={`url(#area-gradient-${key})`}
                strokeWidth={2}
              />
            ))}
          </LazyAreaChart>
        ) : (
          // Default: bar chart
          <LazyBarChart data={data}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis dataKey={nameKey} tick={axisStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={{ stroke: gridStroke }} tickLine={false} />
            <Tooltip
              content={<GlassTooltip />}
            />
            <Legend
              content={<GlassLegend />}
            />
            {keys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[i % colors.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </LazyBarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Lazy-loaded Chart block component.
 * Only loads Recharts when a chart block is first encountered.
 */
export function ChartBlock(props: ChartBlockProps) {
  return (
    <Suspense
      fallback={
        <div className="my-4 flex h-32 items-center justify-center rounded-lg border border-white/5 bg-white/5">
          <div className="flex items-center gap-2 text-white/30">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-primary" />
            <span className="text-xs">Loading chart renderer...</span>
          </div>
        </div>
      }
    >
      <ChartBlockInner {...props} />
    </Suspense>
  );
}
