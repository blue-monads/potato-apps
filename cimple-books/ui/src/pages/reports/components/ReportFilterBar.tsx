import React from 'react';
import { Calendar, Filter } from 'lucide-react';

export type RangePreset = 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
export type AsOfPreset = 'today' | 'month_end' | 'last_month_end' | 'year_end' | 'custom';

interface RangeFilterProps {
    mode: 'range';
    preset: RangePreset;
    startDate: string;
    endDate: string;
    onPresetChange: (preset: RangePreset) => void;
    onStartDateChange: (val: string) => void;
    onEndDateChange: (val: string) => void;
    extraFilters?: React.ReactNode;
}

interface AsOfFilterProps {
    mode: 'asOfDate';
    asOfDate: string;
    onAsOfDateChange: (val: string) => void;
    extraFilters?: React.ReactNode;
}

type ReportFilterBarProps = RangeFilterProps | AsOfFilterProps;

export const getDateRangeFromPreset = (preset: RangePreset): { startDate: string; endDate: string } => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed

    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'this_month') {
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) };
    }
    if (preset === 'last_month') {
        const firstDay = new Date(y, m - 1, 1);
        const lastDay = new Date(y, m, 0);
        return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) };
    }
    if (preset === 'this_quarter') {
        const quarterMonth = Math.floor(m / 3) * 3;
        const firstDay = new Date(y, quarterMonth, 1);
        const lastDay = new Date(y, quarterMonth + 3, 0);
        return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) };
    }
    if (preset === 'this_year') {
        const firstDay = new Date(y, 0, 1);
        const lastDay = new Date(y, 11, 31);
        return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) };
    }
    return { startDate: '', endDate: '' };
};

export const ReportFilterBar: React.FC<ReportFilterBarProps> = (props) => {
    if (props.mode === 'asOfDate') {
        return (
            <div className="bg-white rounded-xl border border-[#E1E3DB] p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                        <Calendar className="w-4 h-4 text-stone-500" />
                        <span>As of Date:</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={props.asOfDate}
                            onChange={(e) => props.onAsOfDateChange(e.target.value)}
                            className="text-xs font-medium text-stone-800 bg-[#F8F9F6] border border-[#E1E3DB] rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-[#2E6E52]"
                        />

                        {/* Quick shortcuts */}
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => {
                                    const now = new Date();
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    props.onAsOfDateChange(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const now = new Date();
                                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    props.onAsOfDateChange(`${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`);
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
                            >
                                End of Month
                            </button>
                        </div>
                    </div>
                </div>

                {props.extraFilters && (
                    <div className="flex items-center gap-3">
                        {props.extraFilters}
                    </div>
                )}
            </div>
        );
    }

    // Range mode
    const PRESETS: Array<{ id: RangePreset; label: string }> = [
        { id: 'all', label: 'All Time' },
        { id: 'this_month', label: 'This Month' },
        { id: 'last_month', label: 'Last Month' },
        { id: 'this_quarter', label: 'This Quarter' },
        { id: 'this_year', label: 'This Year' },
        { id: 'custom', label: 'Custom' },
    ];

    return (
        <div className="bg-white rounded-xl border border-[#E1E3DB] p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-xs font-semibold text-stone-600 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-stone-400" />
                    <span>Period:</span>
                </span>

                <div className="flex flex-wrap items-center gap-1 bg-[#F4F5F1] p-1 rounded-lg border border-[#E1E3DB]">
                    {PRESETS.map((p) => {
                        const active = props.preset === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                    props.onPresetChange(p.id);
                                    if (p.id !== 'custom') {
                                        const { startDate, endDate } = getDateRangeFromPreset(p.id);
                                        props.onStartDateChange(startDate);
                                        props.onEndDateChange(endDate);
                                    }
                                }}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                    active
                                        ? 'bg-white text-[#2E6E52] shadow-xs'
                                        : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
                                }`}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                </div>

                {/* Custom inputs or visible range */}
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={props.startDate}
                        onChange={(e) => {
                            props.onStartDateChange(e.target.value);
                            props.onPresetChange('custom');
                        }}
                        className="text-xs font-medium text-stone-800 bg-[#F8F9F6] border border-[#E1E3DB] rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-[#2E6E52]"
                        title="Start date"
                    />
                    <span className="text-stone-400 text-xs">to</span>
                    <input
                        type="date"
                        value={props.endDate}
                        onChange={(e) => {
                            props.onEndDateChange(e.target.value);
                            props.onPresetChange('custom');
                        }}
                        className="text-xs font-medium text-stone-800 bg-[#F8F9F6] border border-[#E1E3DB] rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-[#2E6E52]"
                        title="End date"
                    />
                </div>
            </div>

            {props.extraFilters && (
                <div className="flex items-center gap-3">
                    {props.extraFilters}
                </div>
            )}
        </div>
    );
};
