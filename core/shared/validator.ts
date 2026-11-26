import { ValidationError } from './errors';

export const validator = {
  isValidDate(dateString: string): boolean {
    const regEx = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateString.match(regEx)) return false;
    const d = new Date(dateString);
    const dNum = d.getTime();
    if (!dNum && dNum !== 0) return false;
    return d.toISOString().slice(0, 10) === dateString;
  },

  assertValidDate(dateString: string, fieldName = 'Date') {
    if (!this.isValidDate(dateString)) {
      throw new ValidationError(`Invalid date format for ${fieldName}. Expected YYYY-MM-DD, got: ${dateString}`);
    }
  },

  isValidGeoJSONPolygon(geoData: any): boolean {
    if (!geoData || typeof geoData !== 'object') return false;
    if (geoData.type !== 'Polygon') return false;
    if (!Array.isArray(geoData.coordinates) || geoData.coordinates.length === 0) return false;
    
    const ring = geoData.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4) return false;
    
    // Check if closed ring
    const firstPoint = ring[0];
    const lastPoint = ring[ring.length - 1];
    
    if (!Array.isArray(firstPoint) || firstPoint.length !== 2) return false;
    if (!Array.isArray(lastPoint) || lastPoint.length !== 2) return false;
    
    return firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1];
  },

  assertValidPolygon(geoData: any, fieldName = 'Geometry') {
    if (!this.isValidGeoJSONPolygon(geoData)) {
      throw new ValidationError(`Invalid GeoJSON Polygon provided for ${fieldName}`);
    }
  }
};
