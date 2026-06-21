import React, { useState, useEffect, useRef } from 'react';
import { 
  LogIn, 
  LogOut, 
  RotateCcw, 
  Trash2, 
  CheckCircle2, 
  CircleDashed, 
  Sparkles, 
  FileText, 
  X, 
  Loader2,
  ListRestart,
  Box,
  MapPin,
  Clock,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Download,
  Upload
} from 'lucide-react';

interface BoxLog {
  id: number;
  arrival: string | null;
  departure: string | null;
  comment: string;
}

export default function App() {
  // Initialize 30 boxes, attempting to load from Local Storage first
  const [boxes, setBoxes] = useState<BoxLog[]>(() => {
    const saved = localStorage.getItem('arrival-departure-log');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved data', e);
      }
    }
    return Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      arrival: null,
      departure: null,
      comment: '',
    }));
  });

  const [resetConfirm, setResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gemini API client features via Server proxy
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  // Auto-dismiss notifications
  useEffect(() => {
    if (errorNotification) {
      const timer = setTimeout(() => setErrorNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorNotification]);

  useEffect(() => {
    if (successNotification) {
      const timer = setTimeout(() => setSuccessNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [successNotification]);

  // Save to Local Storage whenever boxes change
  useEffect(() => {
    localStorage.setItem('arrival-departure-log', JSON.stringify(boxes));
  }, [boxes]);

  const updateBox = (id: number, field: keyof BoxLog, value: any) => {
    setBoxes(prev =>
      prev.map((box) => (box.id === id ? { ...box, [field]: value } : box))
    );
  };

  const setTime = (id: number, type: 'arrival' | 'departure') => {
    const now = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    updateBox(id, type, now);
  };

  const resetBox = (id: number) => {
    setBoxes(prev =>
      prev.map((box) =>
        box.id === id
          ? { ...box, arrival: null, departure: null, comment: '' }
          : box
      )
    );
  };

  const handleResetAll = () => {
    if (resetConfirm) {
      setBoxes(
        Array.from({ length: 30 }, (_, i) => ({
          id: i + 1,
          arrival: null,
          departure: null,
          comment: '',
        }))
      );
      setResetConfirm(false);
      setSuccessNotification("All locations successfully reset to default idle status.");
    } else {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000); // Reset confirmation after 3 seconds
    }
  };

  const getStatus = (box: BoxLog) => {
    if (box.arrival && !box.departure) return 'occupied';
    if (box.arrival && box.departure) return 'completed';
    return 'empty';
  };

  const handleGenerateReport = async () => {
    setIsReportModalOpen(true);
    setIsGeneratingReport(true);
    setReportContent("");
    setErrorNotification(null);
    
    const activeData = boxes.filter(b => b.arrival || b.departure || b.comment.trim());
    if (activeData.length === 0) {
      setReportContent("No active logs to analyze today. Please log some arrivals or add comments to test clinical/operational shift summaries.");
      setIsGeneratingReport(false);
      return;
    }

    try {
      const res = await fetch('/api/gemini/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeData }),
      });

      if (!res.ok) {
        throw new Error('Failed to reach server-side reporting engine');
      }

      const data = await res.json();
      setReportContent(data.text || 'No response from AI agent.');
    } catch (e: any) {
      console.error(e);
      setReportContent("Unable to request shift summary. Check your server settings or API secrets.");
      setErrorNotification("Error reaching Gemini API server backend. Make sure GEMINI_API_KEY is configured.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  /**
   * Parse a single line of CSV compliant with RFC 4180
   */
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped double quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  /**
   * Export boxes database to CSV
   */
  const handleExportCSV = () => {
    // Generate Header RFC 4180
    let csvContent = 'id,arrival,departure,comment\r\n';
    
    boxes.forEach(box => {
      const idStr = String(box.id);
      const arrivalStr = box.arrival ? `"${box.arrival.replace(/"/g, '""')}"` : '""';
      const departureStr = box.departure ? `"${box.departure.replace(/"/g, '""')}"` : '""';
      const commentStr = box.comment ? `"${box.comment.replace(/"/g, '""')}"` : '""';
      
      csvContent += `${idStr},${arrivalStr},${departureStr},${commentStr}\r\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `operations_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessNotification("CSV Export complete!");
  };

  /**
   * Process uploading and parsing a CSV file
   */
  const handleImportCSVClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        // Split rows considering standard line endings
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
          throw new Error("CSV file does not contain valid data rows.");
        }

        // Parse header
        const headerCols = parseCSVLine(lines[0]).map(col => col.toLowerCase());
        const idIndex = headerCols.indexOf('id');
        const arrivalIndex = headerCols.indexOf('arrival');
        const departureIndex = headerCols.indexOf('departure');
        const commentIndex = headerCols.indexOf('comment');

        if (idIndex === -1) {
          throw new Error("Missing 'id' column in CSV headers.");
        }

        // Clone current boxes to prepare updating them
        const newBoxes = Array.from({ length: 30 }, (_, i) => ({
          id: i + 1,
          arrival: null as string | null,
          departure: null as string | null,
          comment: '',
        }));

        let parsedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length < Math.max(idIndex, arrivalIndex, departureIndex, commentIndex)) continue;

          const idVal = parseInt(cols[idIndex], 10);
          if (isNaN(idVal) || idVal < 1 || idVal > 30) {
            continue; // Ignore invalid location index outside 1-30 boundary
          }

          const targetBox = newBoxes[idVal - 1];
          if (targetBox) {
            if (arrivalIndex !== -1 && cols[arrivalIndex]) {
              targetBox.arrival = cols[arrivalIndex] || null;
            }
            if (departureIndex !== -1 && cols[departureIndex]) {
              targetBox.departure = cols[departureIndex] || null;
            }
            if (commentIndex !== -1 && cols[commentIndex]) {
              targetBox.comment = cols[commentIndex];
            }
            parsedCount++;
          }
        }

        if (parsedCount === 0) {
          throw new Error("No matching location records between indices 1 and 30 were found.");
        }

        setBoxes(newBoxes);
        setSuccessNotification(`Successfully imported operational data for ${parsedCount} locations!`);
      } catch (err: any) {
        console.error(err);
        setErrorNotification(`CSV Import failed: ${err.message || 'Check column layout.'}`);
      }

      // Reset file input so same file can be imported again
      if (e.target) {
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  const occupiedCount = boxes.filter((b) => b.arrival && !b.departure).length;
  const completedCount = boxes.filter((b) => b.arrival && b.departure).length;
  const idleCount = 30 - occupiedCount - completedCount;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Warning Notification */}
      {errorNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-bounce">
          <div className="bg-red-950 border border-red-700 text-red-200 px-4 py-3 rounded-xl shadow-2xl flex items-start gap-3">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-300">System Alert</p>
              <p className="text-sm mt-0.5">{errorNotification}</p>
            </div>
            <button onClick={() => setErrorNotification(null)} className="text-red-400 hover:text-red-200">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Top Success Notification */}
      {successNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4">
          <div className="bg-emerald-950 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-start gap-3">
            <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Success</p>
              <p className="text-sm mt-0.5">{successNotification}</p>
            </div>
            <button onClick={() => setSuccessNotification(null)} className="text-emerald-400 hover:text-emerald-200">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 md:px-8 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Box size={28} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">OPERATIONS LOGGER</h1>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest bg-emerald-500 text-slate-950 rounded bg-opacity-95">LIVE</span>
              </div>
              <p className="text-xs text-slate-400">
                Optimized workspace coordinating real-time status and telemetry logs for 30 locations
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:self-center">
            {/* Real-time stats */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1.5 gap-2 mr-1">
              <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-center min-w-16">
                <p className="text-sm font-black">{occupiedCount}</p>
                <p className="text-[9px] uppercase tracking-wider font-semibold opacity-80">Occupied</p>
              </div>
              <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-center min-w-16">
                <p className="text-sm font-black">{completedCount}</p>
                <p className="text-[9px] uppercase tracking-wider font-semibold opacity-80">Finished</p>
              </div>
              <div className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-center min-w-16">
                <p className="text-sm font-black">{idleCount}</p>
                <p className="text-[9px] uppercase tracking-wider font-semibold opacity-80">Idle</p>
              </div>
            </div>

            {/* Hidden Input for CSV Import */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".csv" 
              className="hidden" 
              id="csv-file-input"
            />

            {/* CSV Import Button */}
            <button
              onClick={handleImportCSVClick}
              id="btn-import-csv"
              title="Import shift log state from CSV document containing 'id, arrival, departure, comment' headers"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 active:scale-95"
            >
              <Upload size={14} />
              Import CSV
            </button>

            {/* CSV Export Button */}
            <button
              onClick={handleExportCSV}
              id="btn-export-csv"
              title="Download currently logged states directly to an RFC 4180 CSV spreadsheet"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 active:scale-95"
            >
              <Download size={14} />
              Export CSV
            </button>

            {/* AI Report Button */}
            <button
              onClick={handleGenerateReport}
              id="btn-generate-report"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/10 border border-indigo-500 active:scale-95"
            >
              <Sparkles size={14} />
              Shift Summary
            </button>

            {/* Reset All Button */}
            <button
              onClick={handleResetAll}
              id="btn-reset-all"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all border ${
                resetConfirm
                  ? 'bg-red-500 border-red-400 text-white animate-pulse'
                  : 'bg-slate-950 border-slate-800 text-red-400 hover:bg-red-950/40 hover:border-red-900/50'
              }`}
            >
              <Trash2 size={14} />
              {resetConfirm ? 'Confirm Reset All' : 'Reset Logs'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="max-w-7xl mx-auto px-4 py-8 md:px-8 w-full flex-1">
        {/* Visual Tip Box */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 rounded-2xl border border-slate-800 p-4 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="text-indigo-400 shrink-0" size={20} />
            <div className="text-sm text-slate-300">
              <strong className="text-white font-semibold">Operational CSV Coordination & Shift Summary:</strong> Seamlessly download currently active logs as offline spreadsheets or import them straight back anytime. Take advantage of automated AI Shift Summaries!
            </div>
          </div>
          <div className="text-xs font-mono text-slate-500 py-1 px-3 bg-slate-950 border border-slate-800 rounded-lg shrink-0">
            LOCRES: {boxes.filter(b => b.arrival || b.departure || b.comment.trim()).length} / 30 active
          </div>
        </div>

        {/* 30 Boxes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {boxes.map((box) => {
            const status = getStatus(box);
            
            return (
              <div
                key={box.id}
                id={`box-card-${box.id}`}
                className={`rounded-2xl border bg-slate-950 transition-all duration-300 flex flex-col overflow-hidden relative group/card ${
                  status === 'occupied' 
                    ? 'border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-950/20' 
                    : status === 'completed'
                    ? 'border-slate-800 bg-slate-950/60 opacity-80'
                    : 'border-slate-800 hover:border-slate-700 hover:bg-slate-950/90'
                }`}
              >
                {/* Header detail of card */}
                <div className="px-4 py-3.5 border-b border-slate-800/80 bg-slate-900/30 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    {status === 'occupied' ? (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    ) : status === 'completed' ? (
                      <CheckCircle className="text-slate-500" size={14} />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-slate-700 bg-slate-900" />
                    )}
                    <h3 className="font-bold text-white text-base">
                      Location {box.id}
                    </h3>
                  </div>

                  <button
                    onClick={() => resetBox(box.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all"
                    title="Reset Location logs"
                    id={`btn-reset-box-${box.id}`}
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                {/* Input panel of card */}
                <div className="p-4 flex-1 flex flex-col gap-4">
                  {/* Arrival Row */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTime(box.id, 'arrival')}
                      id={`btn-arrival-${box.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-xl font-semibold text-xs transition-all active:scale-95"
                    >
                      <LogIn size={13} />
                      Arrival
                    </button>
                    <div className="w-24 text-center py-2 text-xs font-mono bg-slate-900 text-emerald-300 rounded-xl border border-slate-800/80">
                      {box.arrival || '--:--:--'}
                    </div>
                  </div>

                  {/* Departure Row */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTime(box.id, 'departure')}
                      id={`btn-departure-${box.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-xl font-semibold text-xs transition-all active:scale-95"
                    >
                      <LogOut size={13} />
                      Depart
                    </button>
                    <div className="w-24 text-center py-2 text-xs font-mono bg-slate-900 text-amber-300 rounded-xl border border-slate-800/80">
                      {box.departure || '--:--:--'}
                    </div>
                  </div>

                  {/* Comment & AI polisher */}
                  <div className="mt-2 pt-2 border-t border-slate-900 flex flex-col gap-2">
                    <div className="relative">
                      <textarea
                        value={box.comment}
                        onChange={(e) => updateBox(box.id, 'comment', e.target.value)}
                        placeholder="Add operational notes or details..."
                        className="w-full text-xs p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl resize-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all h-[72px] placeholder-slate-600 text-slate-200"
                        id={`input-comment-${box.id}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* AI Shift summary modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden relative animate-in fade-in zoom-in duration-250">
            <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div className="flex items-center gap-3 text-indigo-400">
                <FileText size={20} />
                <h2 className="font-extrabold text-lg text-white tracking-tight text-indigo-300">Shift Log Analysis Summary</h2>
              </div>
              <button 
                onClick={() => setIsReportModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-950/30">
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center py-16 text-indigo-400">
                  <div className="relative flex items-center justify-center mb-4">
                    <div className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-indigo-400 opacity-20"></div>
                    <Loader2 size={36} className="animate-spin relative-z-10" />
                  </div>
                  <p className="font-bold tracking-wide animate-pulse text-sm">Gemini is synthesizing shift logs...</p>
                  <p className="text-xs text-slate-500 mt-1">Aggregating arrivals, departures, and operator logs</p>
                </div>
              ) : (
                <div className="text-slate-300 font-medium text-sm leading-relaxed whitespace-pre-wrap select-text bg-slate-900/60 p-5 rounded-xl border border-slate-800 font-mono">
                  {reportContent}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-all active:scale-95"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elegant Footer details */}
      <footer className="border-t border-slate-800/80 bg-slate-950/40 py-6 mt-12 text-center">
        <p className="text-xs text-slate-500 font-mono">
          OPERATIONS LOGGER © 2026 • AI-PROXIED SECURE GATEWAY
        </p>
      </footer>
    </div>
  );
}

