import React, { useState, useMemo, useRef, useEffect } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

export interface CodeEditorTabProps {
    code: string;
    onChangeCode: (newCode: string) => void;
    onSave: () => void;
    isSaving: boolean;
    saveSuccess: boolean;
    onRunPreview?: () => void;
    fileName?: string;
    versionBadge?: React.ReactNode;
    themeColor?: "violet" | "blue";
    isModified?: boolean;
    onRevert?: () => void;
}

export default function CodeEditorTab({
    code,
    onChangeCode,
    onSave,
    isSaving,
    saveSuccess,
    onRunPreview,
    fileName = "index.html",
    versionBadge,
    themeColor = "violet",
    isModified = false,
    onRevert,
}: CodeEditorTabProps) {
    const [mode, setMode] = useState<"highlight" | "edit">("highlight");
    const [copied, setCopied] = useState<boolean>(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const highlightGutterRef = useRef<HTMLDivElement>(null);
    const preRef = useRef<HTMLPreElement>(null);

    // Generate highlighted HTML using highlight.js
    const highlightedHtml = useMemo(() => {
        if (!code) return "";
        try {
            return hljs.highlight(code, { language: "html" }).value;
        } catch {
            return hljs.highlightAuto(code).value;
        }
    }, [code]);

    const lines = useMemo(() => {
        return (code || "").split("\n");
    }, [code]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Synchronize textarea scroll with line numbers gutter
    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (gutterRef.current) {
            gutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    // Synchronize pre scroll with line numbers gutter
    const handlePreScroll = (e: React.UIEvent<HTMLPreElement>) => {
        if (highlightGutterRef.current) {
            highlightGutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    // Auto-focus textarea when entering edit mode
    useEffect(() => {
        if (mode === "edit" && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [mode]);

    const isViolet = themeColor === "violet";
    const primaryBtnClass = isViolet
        ? "bg-violet-600 hover:bg-violet-700 text-white"
        : "bg-blue-600 hover:bg-blue-700 text-white";

    return (
        <div className="flex-1 min-h-0 flex flex-col w-full h-full bg-surface-50 overflow-hidden">
            {/* Toolbar */}
            <div className="bg-white border-b border-surface-200 px-3 py-2 flex items-center justify-between text-xs text-surface-700 shrink-0 gap-2 flex-wrap shadow-2xs">
                {/* Left: File name, Version badge, Lines info */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-100 border border-surface-200 font-mono text-[11px] font-semibold text-surface-800">
                        <i className="fa-brands fa-html5 text-orange-500 text-xs" />
                        <span>{fileName}</span>
                    </div>

                    {versionBadge}

                    {isModified && (
                        <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            <i className="fa-solid fa-circle-dot text-[7px]" />
                            Unsaved
                        </span>
                    )}

                    <span className="text-[10px] text-surface-400 hidden sm:inline">
                        {lines.length} {lines.length === 1 ? "line" : "lines"} &bull; {code.length} chars
                    </span>
                </div>

                {/* Right: Actions (Mode switch, Revert, Copy, Save, Preview) */}
                <div className="flex items-center gap-1.5">
                    {/* Mode Toggle (Highlight vs Edit) */}
                    <div className="flex items-center bg-surface-100 p-0.5 rounded-lg border border-surface-200 mr-1">
                        <button
                            type="button"
                            onClick={() => setMode("highlight")}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                                mode === "highlight"
                                    ? "bg-white text-surface-900 shadow-2xs"
                                    : "text-surface-500 hover:text-surface-800"
                            }`}
                            title="Syntax Highlighted View"
                        >
                            <i className="fa-solid fa-highlighter text-[10px]" />
                            <span>Highlight</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("edit")}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                                mode === "edit"
                                    ? "bg-white text-surface-900 shadow-2xs"
                                    : "text-surface-500 hover:text-surface-800"
                            }`}
                            title="Edit Code"
                        >
                            <i className="fa-solid fa-pen text-[10px]" />
                            <span>Edit</span>
                        </button>
                    </div>

                    {isModified && onRevert && (
                        <button
                            type="button"
                            onClick={onRevert}
                            className="px-2 py-1 bg-white hover:bg-surface-100 text-surface-600 border border-surface-200 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Revert changes"
                        >
                            <i className="fa-solid fa-rotate-left text-[10px]" />
                            <span className="hidden sm:inline">Revert</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleCopy}
                        className="px-2.5 py-1 bg-white hover:bg-surface-100 text-surface-700 border border-surface-200 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Copy code to clipboard"
                    >
                        <i className={`fa-solid ${copied ? "fa-check text-emerald-500" : "fa-copy"} text-[11px]`} />
                        <span>{copied ? "Copied!" : "Copy"}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onSave}
                        disabled={isSaving}
                        className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer ${primaryBtnClass}`}
                    >
                        {isSaving ? (
                            <>
                                <i className="fa-solid fa-circle-notch fa-spin text-[10px]" />
                                <span>Saving...</span>
                            </>
                        ) : saveSuccess ? (
                            <>
                                <i className="fa-solid fa-check text-[10px]" />
                                <span>Saved!</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-floppy-disk text-[10px]" />
                                <span>Save</span>
                            </>
                        )}
                    </button>

                    {onRunPreview && (
                        <button
                            type="button"
                            onClick={onRunPreview}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                            title="Run and view preview"
                        >
                            <i className="fa-solid fa-play text-[10px]" />
                            <span>Preview</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Code Body Area */}
            <div className="flex-1 min-h-0 bg-white border border-surface-200 rounded-b-lg m-2 mt-0 overflow-hidden flex shadow-xs relative">
                {mode === "highlight" ? (
                    /* 1. SYNTAX HIGHLIGHTED VIEW */
                    <div className="flex-1 min-h-0 flex w-full h-full overflow-hidden bg-white text-surface-800">
                        {/* Line Numbers Gutter */}
                        <div
                            ref={highlightGutterRef}
                            className="w-11 sm:w-12 bg-surface-50 border-r border-surface-200 py-3 text-right pr-2.5 select-none font-mono text-[11px] leading-5 text-surface-400 overflow-hidden shrink-0"
                        >
                            {lines.map((_, i) => (
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>

                        {/* Highlighted Code */}
                        <pre
                            ref={preRef}
                            onScroll={handlePreScroll}
                            className="flex-1 min-h-0 p-3 m-0 overflow-auto font-mono text-[11px] leading-5 bg-white text-surface-800 focus:outline-none"
                            tabIndex={0}
                        >
                            <code
                                className="hljs language-html font-mono text-[11px] leading-5 p-0 bg-transparent block"
                                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                            />
                        </pre>

                        {/* Floating quick edit button */}
                        <button
                            type="button"
                            onClick={() => setMode("edit")}
                            className="absolute bottom-4 right-4 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-900 text-white text-xs font-medium shadow-md flex items-center gap-1.5 transition-all opacity-80 hover:opacity-100 cursor-pointer"
                        >
                            <i className="fa-solid fa-pen-to-square text-[11px]" />
                            <span>Edit Code</span>
                        </button>
                    </div>
                ) : (
                    /* 2. EDIT MODE */
                    <div className="flex-1 min-h-0 flex w-full h-full overflow-hidden bg-white text-surface-800">
                        {/* Line Numbers Gutter */}
                        <div
                            ref={gutterRef}
                            className="w-11 sm:w-12 bg-surface-50 border-r border-surface-200 py-3 text-right pr-2.5 select-none font-mono text-[11px] leading-5 text-surface-400 overflow-hidden shrink-0"
                        >
                            {lines.map((_, i) => (
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>

                        {/* Editable Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={code}
                            onChange={(e) => onChangeCode(e.target.value)}
                            onScroll={handleScroll}
                            spellCheck={false}
                            className="flex-1 min-h-0 p-3 font-mono text-[11px] leading-5 bg-white text-surface-900 outline-none resize-none overflow-auto border-none selection:bg-surface-200"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
