import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Save, MapPin, Minus, Square, X } from 'lucide-react';
import { BASE_PATH } from '../../lib/base';
import { featuresApi } from '../../lib/featuresApi';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

type DrawingMode = 'none' | 'point' | 'line' | 'area';

// Helper function to validate geometry
const isValidPoint = (geom: any): geom is [number, number] => {
    return Array.isArray(geom) && 
           geom.length === 2 && 
           typeof geom[0] === 'number' && 
           typeof geom[1] === 'number' &&
           !isNaN(geom[0]) && 
           !isNaN(geom[1]);
};

const isValidLineOrArea = (geom: any): geom is [number, number][] => {
    return Array.isArray(geom) && 
           geom.length > 0 && 
           geom.every((p: any) => isValidPoint(p));
};

// Component to handle map clicks for drawing
function DrawingHandler({ 
    mode, 
    onDrawComplete, 
    color,
    onPointsChange
}: { 
    mode: DrawingMode; 
    onDrawComplete: (geometry: any) => void;
    color: string;
    onPointsChange?: (points: [number, number][]) => void;
}) {
    const [points, setPoints] = useState<[number, number][]>([]);

    const updatePoints = (newPoints: [number, number][]) => {
        setPoints(newPoints);
        if (onPointsChange) {
            onPointsChange(newPoints);
        }
    };

    useMapEvents({
        click: (e: L.LeafletMouseEvent) => {
            if (mode === 'none') return;
            
            const { lat, lng } = e.latlng;
            const newPoint: [number, number] = [lat, lng];

            if (mode === 'point') {
                onDrawComplete(newPoint);
                setPoints([]);
                if (onPointsChange) onPointsChange([]);
            } else if (mode === 'line') {
                const newPoints = [...points, newPoint];
                updatePoints(newPoints);
                if (newPoints.length >= 2) {
                    onDrawComplete(newPoints);
                    setPoints([]);
                    if (onPointsChange) onPointsChange([]);
                }
            } else if (mode === 'area') {
                const newPoints = [...points, newPoint];
                updatePoints(newPoints);
                // For area, we need at least 3 points, complete on double-click or button
            }
        },
        dblclick: (e: L.LeafletMouseEvent) => {
            if (mode === 'area' && points.length >= 3) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
                onDrawComplete(points);
                setPoints([]);
                if (onPointsChange) onPointsChange([]);
            }
        },
    });

    // Reset points when mode changes
    useEffect(() => {
        setPoints([]);
        if (onPointsChange) onPointsChange([]);
    }, [mode, onPointsChange]);

    return (
        <>
            {mode === 'line' && points.length > 0 && (
                <Polyline
                    positions={points}
                    color={color}
                    weight={3}
                    opacity={0.7}
                    dashArray="5, 5"
                />
            )}
            {mode === 'area' && points.length > 0 && (
                <>
                    <Polyline
                        positions={points}
                        color={color}
                        weight={3}
                        opacity={0.7}
                    />
                    {points.length >= 3 && (
                        <Polygon
                            positions={[...points, points[0]]}
                            color={color}
                            fillColor={color}
                            fillOpacity={0.3}
                            weight={2}
                        />
                    )}
                </>
            )}
        </>
    );
}

const CreateFeature = () => {
    const navigate = useNavigate();
    const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
    const [tempGeometry, setTempGeometry] = useState<any>(null);
    const [areaPoints, setAreaPoints] = useState<[number, number][]>([]);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#3B82F6',
        feature_type: 'point' as 'point' | 'line' | 'area',
    });

    const handleDrawingComplete = useCallback((geometry: any) => {
        // Validate geometry before setting it
        if (!geometry) {
            console.error('Invalid geometry: geometry is null or undefined');
            return;
        }

        // Validate based on type
        if (isValidPoint(geometry)) {
            setTempGeometry(geometry);
            setFormData(prev => ({ ...prev, feature_type: 'point' }));
        } else if (isValidLineOrArea(geometry)) {
            setTempGeometry(geometry);
            setFormData(prev => ({
                ...prev,
                feature_type: geometry.length >= 3 ? 'area' : 'line'
            }));
        } else {
            console.error('Invalid geometry format:', geometry);
            return;
        }
        setDrawingMode('none');
    }, []);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!formData.name.trim()) {
            setError('Please enter a name for the feature');
            return;
        }

        if (!tempGeometry) {
            setError('Please draw a feature on the map first');
            return;
        }

        // Validate geometry before saving
        const isValid = formData.feature_type === 'point' 
            ? isValidPoint(tempGeometry)
            : isValidLineOrArea(tempGeometry) && 
              (formData.feature_type === 'line' ? tempGeometry.length >= 2 : tempGeometry.length >= 3);

        if (!isValid) {
            setError('Invalid geometry. Please draw the feature again.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await featuresApi.create({
                name: formData.name,
                description: formData.description,
                color: formData.color,
                feature_type: formData.feature_type,
                geometry: tempGeometry,
            });

            // Navigate back to features list
            navigate(`${BASE_PATH}features`);
        } catch (err: any) {
            setError(err.message || 'Failed to create feature');
            setLoading(false);
        }
    };

    const handleStartDrawing = (mode: DrawingMode) => {
        setDrawingMode(mode);
        setTempGeometry(null);
        setAreaPoints([]);
        setFormData({ ...formData, feature_type: mode === 'point' ? 'point' : mode === 'line' ? 'line' : 'area' });
    };

    const handleCancelDrawing = () => {
        setDrawingMode('none');
        setTempGeometry(null);
        setAreaPoints([]);
    };

    const handleCompleteArea = useCallback(() => {
        if (areaPoints.length >= 3) {
            handleDrawingComplete(areaPoints);
        }
    }, [areaPoints, handleDrawingComplete]);

    const handleAreaPointsChange = useCallback((points: [number, number][]) => {
        setAreaPoints(points);
    }, []);

    return (
        <div className="h-full flex flex-col">
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Layers className="w-6 h-6 text-gray-700" />
                        <h1 className="text-2xl font-bold text-gray-900">Create New Feature</h1>
                    </div>
                    <button
                        onClick={() => navigate(`${BASE_PATH}features`)}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                        Cancel
                    </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                    Draw a feature on the map and fill in the details
                </p>
            </div>

            {error && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            <div className="flex-1 grid grid-cols-2 gap-6 p-6">
                {/* Feature Editor Form */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Feature Details</h2>

                    <div className="flex-1 overflow-y-auto">
                        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Feature name"
                                />
                            </div>

                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Feature description"
                                />
                            </div>

                            {/* Type Selection (formerly Drawing Tools) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Type *
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleStartDrawing('point')}
                                        className={`flex flex-col items-center gap-1 px-3 py-2 border rounded-lg transition-colors ${
                                            drawingMode === 'point' || formData.feature_type === 'point'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                    >
                                        <MapPin className="w-4 h-4" />
                                        <span className="text-xs">Point</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleStartDrawing('line')}
                                        className={`flex flex-col items-center gap-1 px-3 py-2 border rounded-lg transition-colors ${
                                            drawingMode === 'line' || formData.feature_type === 'line'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                    >
                                        <Minus className="w-4 h-4" />
                                        <span className="text-xs">Line</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleStartDrawing('area')}
                                        className={`flex flex-col items-center gap-1 px-3 py-2 border rounded-lg transition-colors ${
                                            drawingMode === 'area' || formData.feature_type === 'area'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                    >
                                        <Square className="w-4 h-4" />
                                        <span className="text-xs">Area</span>
                                    </button>
                                </div>
                                {drawingMode !== 'none' && (
                                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                                        {drawingMode === 'point' && 'Click on the map to place a point'}
                                        {drawingMode === 'line' && 'Click on the map to add points to the line (2+ points)'}
                                        {drawingMode === 'area' && (
                                            <>
                                                Click on the map to add points to the area (3+ points needed)
                                                {areaPoints.length >= 3 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleCompleteArea}
                                                        className="ml-2 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                                    >
                                                        Complete Area
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleCancelDrawing}
                                            className="ml-2 text-blue-600 hover:text-blue-800"
                                        >
                                            <X className="w-3 h-3 inline" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-1">
                                    Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        id="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="#3B82F6"
                                    />
                                </div>
                            </div>

                            {tempGeometry && (
                                <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                                    ✓ Geometry captured. Fill in details and save.
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-200 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate(`${BASE_PATH}features`)}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!tempGeometry || !formData.name.trim() || loading}
                                    className="flex items-center gap-2 flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Save className="w-4 h-4" />
                                    {loading ? 'Creating...' : 'Create Feature'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Map */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-sm font-semibold text-gray-800">Map</h3>
                    </div>
                    <div className="flex-1" style={{ minHeight: '400px' }}>
                        <MapContainer
                            center={[51.505, -0.09]}
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
                                onPointsChange={drawingMode === 'area' ? handleAreaPointsChange : undefined}
                            />
                            
                            {/* Display temp geometry */}
                            {tempGeometry && formData.feature_type === 'point' && isValidPoint(tempGeometry) && (
                                <Marker position={tempGeometry} />
                            )}
                            {tempGeometry && formData.feature_type === 'line' && isValidLineOrArea(tempGeometry) && tempGeometry.length >= 2 && (
                                <Polyline
                                    positions={tempGeometry}
                                    color={formData.color}
                                    weight={3}
                                />
                            )}
                            {tempGeometry && formData.feature_type === 'area' && isValidLineOrArea(tempGeometry) && tempGeometry.length >= 3 && (
                                <Polygon
                                    positions={[...tempGeometry, tempGeometry[0]]}
                                    color={formData.color}
                                    fillColor={formData.color}
                                    fillOpacity={0.3}
                                    weight={2}
                                />
                            )}
                        </MapContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateFeature;
