import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationValue } from '../pages/Builder/sub/ftype';

interface LocationPickerProps {
  value?: LocationValue | string | null;
  onChange: (val: LocationValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Parse location value safely
  const parsedValue: LocationValue | null = useMemo(() => {
    if (!value) return null;
    if (typeof value === 'object' && typeof value.lat === 'number' && typeof value.lng === 'number') {
      return value as LocationValue;
    }
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          return parsed;
        }
      } catch {
        const parts = value.split(',').map(s => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return { lat: parts[0], lng: parts[1] };
        }
      }
    }
    return null;
  }, [value]);

  const defaultCenter: [number, number] = parsedValue
    ? [parsedValue.lat, parsedValue.lng]
    : [27.7172, 85.3240]; // Default fallback

  const defaultZoom = parsedValue ? 15 : 12;

  // Custom marker icon using Font Awesome
  const createPinIcon = () => {
    return L.divIcon({
      className: 'custom-leaflet-pin',
      html: `
        <div style="
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 28px;
            height: 28px;
            background-color: #2E6E52;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid #ffffff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <i class="fa-solid fa-location-dot" style="
              transform: rotate(45deg);
              color: white;
              font-size: 13px;
            "></i>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 30],
      popupAnchor: [0, -28],
    });
  };

  // Reverse geocode to get human-friendly address
  const fetchAddress = async (lat: number, lng: number): Promise<string | undefined> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        return data.display_name || undefined;
      }
    } catch {
      // Quiet fail if reverse geocoding is unavailable
    }
    return undefined;
  };

  // Update position helper
  const updatePosition = async (lat: number, lng: number, address?: string) => {
    const formattedLat = Math.round(lat * 1000000) / 1000000;
    const formattedLng = Math.round(lng * 1000000) / 1000000;

    let resolvedAddress = address;
    if (!resolvedAddress) {
      resolvedAddress = await fetchAddress(formattedLat, formattedLng);
    }

    onChange({
      lat: formattedLat,
      lng: formattedLng,
      address: resolvedAddress,
    });
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Handle map clicks to place/move marker
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (disabled) return;
        const { lat, lng } = e.latlng;
        updatePosition(lat, lng);
      });

      mapInstanceRef.current = map;

      // Invalidate size after DOM layout stabilizes
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    const map = mapInstanceRef.current;

    // Update or create marker
    if (parsedValue) {
      const pos: [number, number] = [parsedValue.lat, parsedValue.lng];
      if (!markerRef.current) {
        const marker = L.marker(pos, {
          icon: createPinIcon(),
          draggable: !disabled,
        }).addTo(map);

        marker.on('dragend', () => {
          if (disabled) return;
          const latlng = marker.getLatLng();
          updatePosition(latlng.lat, latlng.lng);
        });

        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng(pos);
      }
      map.panTo(pos);
    } else {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    }

    return () => {
      // Map stays alive across renders unless container unmounts
    };
  }, [parsedValue, disabled]);

  // Clean up map when component completely unmounts
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Geolocation button handler
  const handleLocateMe = () => {
    if (disabled || isLocating) return;
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 16);
        }
        updatePosition(latitude, longitude);
      },
      (err) => {
        setIsLocating(false);
        setGeoError(err.message || 'Unable to retrieve location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Search location by place name handler
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    setGeoError(null);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const item = results[0];
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([lat, lng], 15);
          }
          updatePosition(lat, lng, item.display_name);
        } else {
          setGeoError('Place not found. Try a different search term.');
        }
      }
    } catch {
      setGeoError('Failed to search location.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Search and Locate Controls */}
      {!disabled && (
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="flex-1 relative flex items-center">
            <i className="fa-solid fa-magnifying-glass absolute left-2.5 text-xs text-gray-400"></i>
            <input
              type="text"
              placeholder={placeholder || 'Search place or address...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-16 py-2 rounded-lg border border-[#CBCEC3] bg-white outline-none focus:border-[#2E6E52] transition-colors"
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-1.5 px-2 py-1 text-[11px] font-semibold text-white bg-[#2E6E52] hover:brightness-105 rounded disabled:opacity-40 transition-all"
            >
              {isSearching ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Find'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            title="Locate me"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-100 border border-[#CBCEC3] rounded-lg shadow-2xs transition-colors flex-shrink-0"
          >
            <i className={`fa-solid ${isLocating ? 'fa-circle-notch fa-spin text-[#2E6E52]' : 'fa-crosshairs text-gray-500'}`}></i>
            <span className="hidden sm:inline">My Location</span>
          </button>
        </div>
      )}

      {/* Map Container */}
      <div className="relative border border-[#CBCEC3] rounded-xl overflow-hidden shadow-2xs">
        <div
          ref={mapContainerRef}
          style={{ height: '240px', width: '100%', zIndex: 0 }}
          className="bg-gray-100"
        />

        {/* Floating helper overlay */}
        {!parsedValue && (
          <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-medium text-gray-700 shadow-xs border border-black/5 pointer-events-none flex items-center gap-1.5">
            <i className="fa-solid fa-map-pin text-[#2E6E52]"></i>
            <span>Click anywhere on the map to pin location</span>
          </div>
        )}
      </div>

      {/* Selected Location Card */}
      {parsedValue ? (
        <div className="flex items-center justify-between p-2.5 bg-white border border-[#CBCEC3] rounded-lg shadow-2xs text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-md bg-[#2E6E52]/10 text-[#2E6E52] flex items-center justify-center text-xs flex-shrink-0">
              <i className="fa-solid fa-location-dot"></i>
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate">
                {parsedValue.address || `Lat: ${parsedValue.lat}, Lng: ${parsedValue.lng}`}
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                {parsedValue.lat.toFixed(6)}, {parsedValue.lng.toFixed(6)}
              </div>
            </div>
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors text-xs flex-shrink-0 ml-2"
              title="Clear location"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      ) : null}

      {geoError && (
        <p className="text-xs text-red-500 font-medium flex items-center gap-1">
          <i className="fa-solid fa-circle-exclamation"></i>
          <span>{geoError}</span>
        </p>
      )}
    </div>
  );
};
