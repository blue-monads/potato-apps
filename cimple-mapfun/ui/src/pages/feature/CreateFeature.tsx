import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    Layers, 
    MapPin, 
    Route, 
    Hexagon, 
    Sparkles, 
    ArrowLeft, 
    Check, 
    AlertCircle, 
    RotateCcw 
} from 'lucide-react';
import { BASE_PATH } from '../../lib/base';
import { featuresApi, isValidPoint, isValidLine, isValidArea } from '../../lib/featuresApi';
import { Header } from '../../components/Header';

type DrawingMode = 'none' | 'point' | 'line' | 'area';

const PRESET_COLORS = [
    { name: 'Indigo', hex: '#6366f1' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Sky', hex: '#0284c7' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Rose', hex: '#f43f5e' },
    { name: 'Violet', hex: '#8b5cf6' },
];

function DrawingHandler({ 
    mode, 
    onDrawComplete, 
    color,
    points,
    setPoints,
}: { 
    mode: DrawingMode; 
    onDrawComplete: (geometry: any) => void;
    color: string;
    points: [number, number][];
    setPoints: React.Dispatch<React.SetStateAction<[number, number][]>>;
}) {
    useMapEvents({
        click: (e: L.LeafletMouseEvent) => {
            if (mode === 'none') return;
            
            const { lat, lng } = e.latlng;
            const newPoint: [number, number] = [lat, lng];

            if (mode === 'point') {
                onDrawComplete(newPoint);
                setPoints([newPoint]);
            } else if (mode === 'line') {
                const next = [...points, newPoint];
                setPoints(next);
                if (next.length >= 2) {
                    onDrawComplete(next);
                }
            } else if (mode === 'area') {
                const next = [...points, newPoint];
                setPoints(next);
                if (next.length >= 3) {
                    onDrawComplete(next);
                }
            }
        },
        dblclick: (e: L.LeafletMouseEvent) => {
            if (mode === 'area' && points.length >= 3) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
                onDrawComplete(points);
            }
        },
    });

    return (
        <>
            {mode === 'line' && points.length >= 2 && (
                <Polyline
                    positions={points}
                    color={color}
                    weight={4}
                    dashArray="6, 6"
                />
            )}
            {mode === 'area' && (
                <>
                    {points.length === 2 && (
                        <Polyline
                            positions={points}
                            color={color}
                            weight={3}
                            dashArray="6, 6"
                        />
                    )}
                    {points.length >= 3 && (
                        <Polygon
                            positions={points}
                            color={color}
                            fillColor={color}
                            fillOpacity={0.25}
                            weight={3}
                        />
                    )}
                </>
            )}
            {points.map((pt, idx) => (
                <Marker
                    key={`draw-${idx}`}
                    position={pt}
                    icon={L.divIcon({
                        className: 'drawing-point-dot',
                        html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>`,
                        iconAnchor: [6, 6],
                    })}
                />
            ))}
        </>
    );
}

const CreateFeature = () => {
    const navigate = useNavigate();
    const [drawingMode, setDrawingMode] = useState<DrawingMode>('point');
    const [points, setPoints] = useState<[number, number][]>([]);
    const [geometry, setGeometry] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#6366f1',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mapCenter] = useState<[number, number]>([27.7172, 85.3240]);

    const handleDrawingComplete = useCallback((geom: any) => {
        setGeometry(geom);
        setError(null);
    }, []);

    const handleModeSwitch = (mode: DrawingMode) => {
        setDrawingMode(mode);
        setPoints([]);
        setGeometry(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Please enter a feature name');
            return;
        }

        if (!geometry) {
            setError('Please draw the feature on the map first');
            return;
        }

        const featureType = drawingMode === 'point' ? 'point' : drawingMode === 'line' ? 'line' : 'area';

        if (featureType === 'point' && !isValidPoint(geometry)) {
            setError('Invalid point coordinates');
            return;
        }
        if (featureType === 'line' && !isValidLine(geometry)) {
            setError('Lines require at least 2 points');
            return;
        }
        if (featureType === 'area' && !isValidArea(geometry)) {
            setError('Areas require at least 3 points');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await featuresApi.create({
                name: formData.name.trim(),
                description: formData.description,
                color: formData.color,
                feature_type: featureType,
                geometry: geometry,
            });

            navigate(`${BASE_PATH}features`);
        } catch (err: any) {
            setError(err.message || 'Failed to create feature');
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full flex flex-col bg-[#f7f8fa] text-gray-900 overflow-hidden font-sans">
            <Header />

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* Left Studio Form Pane */}
                <div className="w-full md:w-[440px] lg:w-[480px] shrink-0 bg-white border-r border-gray-200 flex flex-col h-full shadow-xs z-10">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                <Layers className="w-4 h-4" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-gray-900 tracking-tight">Feature Creator</h1>
                                <p className="text-xs text-gray-500">Draw spatial objects directly on the map</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate(`${BASE_PATH}features`)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200 shadow-2xs transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                        </button>
                    </div>

                    {/* Scrollable Form Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Drawing Tool Switcher */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-2">
                                Select Shape Type
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('point')}
                                    className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                                        drawingMode === 'point'
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs font-semibold'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                                >
                                    <MapPin className="w-4 h-4 text-indigo-600" />
                                    <span className="text-xs">Marker Point</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('line')}
                                    className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                                        drawingMode === 'line'
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs font-semibold'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                                >
                                    <Route className="w-4 h-4 text-blue-600" />
                                    <span className="text-xs">Polyline Path</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('area')}
                                    className={`p-2.5 rounded-lg border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                                        drawingMode === 'area'
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs font-semibold'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                                >
                                    <Hexagon className="w-4 h-4 text-emerald-600" />
                                    <span className="text-xs">Area Boundary</span>
                                </button>
                            </div>
                        </div>

                        {/* Drawing Status & Instructions */}
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-700">
                                    Drawing Guide
                                </span>
                                {points.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPoints([]);
                                            setGeometry(null);
                                        }}
                                        className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Reset</span>
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">
                                {drawingMode === 'point' && 'Click once anywhere on the map to place the point pin.'}
                                {drawingMode === 'line' && `Click points on the map to add segments (${points.length} points placed).`}
                                {drawingMode === 'area' && `Click at least 3 points to enclose an area (${points.length} points placed).`}
                            </p>
                        </div>

                        <form id="feature-form" onSubmit={handleSave} className="space-y-4">
                            {/* Feature Name */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Feature Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="e.g. Restricted Perimeter, Hiking Trail, Landmark"
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Description / Notes
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                                    placeholder="Optional notes or details..."
                                />
                            </div>

                            {/* Color Theme */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Color
                                </label>
                                <div className="flex items-center gap-2">
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c.hex}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color: c.hex })}
                                            className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${
                                                formData.color === c.hex
                                                    ? 'border-gray-800 scale-110 shadow-xs'
                                                    : 'border-transparent hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: c.hex }}
                                            title={c.name}
                                        >
                                            {formData.color === c.hex && (
                                                <Check className="w-3.5 h-3.5 text-white" />
                                            )}
                                        </button>
                                    ))}
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-7 h-7 rounded-full overflow-hidden border border-gray-300 cursor-pointer bg-transparent"
                                    />
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-3.5 border-t border-gray-200 bg-white flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(`${BASE_PATH}features`)}
                            className="px-3.5 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-medium transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            form="feature-form"
                            disabled={loading || !geometry}
                            className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Save Feature</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Interactive Drawing Map Canvas */}
                <div className="flex-1 h-full relative bg-gray-100">
                    <MapContainer
                        center={mapCenter}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <DrawingHandler
                            mode={drawingMode}
                            onDrawComplete={handleDrawingComplete}
                            color={formData.color}
                            points={points}
                            setPoints={setPoints}
                        />
                    </MapContainer>

                    {/* Floating Map HUD Banner */}
                    <div className="absolute top-4 left-4 z-[900] pointer-events-none">
                        <div className="bg-white/95 backdrop-blur-md border border-gray-200 px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                            <span className="text-xs font-medium text-gray-700">
                                Mode: <strong className="capitalize text-indigo-600">{drawingMode}</strong> • Click on map to add geometry
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateFeature;
