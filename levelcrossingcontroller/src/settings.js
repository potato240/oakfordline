import { TRACK_HALF_WIDTH, TRACK_SPACING } from './constants.js';

// Every customisation option, with the value used in code and the label
// shown in the UI - main.js builds the <select> elements straight from
// these lists so adding an option here is enough to add it everywhere.
export const BARRIER_TYPES = [
  { value: 'default', label: 'Default (full boom)' },
  { value: 'half', label: 'Half barrier' },
  { value: 'double', label: 'Double barrier' },
  { value: 'swing', label: 'Swing gate' },
  { value: 'trolley', label: 'Trolley gate' },
  { value: 'none', label: 'None' },
];

// These are stylised, simplified homages to how different countries'
// crossings tend to look (a crossbuck here, lamps arranged differently
// there) - not accurate reproductions of any real country's actual
// signalling standard, except 'uk' and 'america', which are modelled on
// the real thing more deliberately (see protection.js). 'france' sits in
// between: the red crossbuck is a genuine distinguishing feature, the rest
// is a reasonable guess rather than a verified sequence like 'uk'/'america'.
export const LIGHT_STYLES = [
  { value: 'default', label: 'Default' },
  { value: 'uk', label: 'UK' },
  { value: 'america', label: 'America' },
  { value: 'france', label: 'France' },
  { value: 'sweden', label: 'Sweden' },
  { value: 'netherlands', label: 'The Netherlands' },
  { value: 'none', label: 'None' },
];

export const TRACK_COUNTS = [1, 2, 3, 4];

export const SURROUNDINGS = [
  { value: 'default', label: 'Default' },
  { value: 'city', label: 'City' },
  { value: 'town', label: 'Town' },
  { value: 'farm', label: 'Farm' },
  { value: 'village', label: 'Village' },
  { value: 'rural', label: 'Rural' },
];

export const DEFAULT_SETTINGS = {
  barrierType: 'default',
  lightStyle: 'default',
  trackCount: 1,
  surroundings: 'default',
};

// The Z half-extent of the combined danger corridor across every track -
// used both to build the track geometry and to place the stop line/collision
// bands, so the two can never drift out of sync with each other.
export function combinedTrackHalfWidth(trackCount) {
  return TRACK_HALF_WIDTH + ((trackCount - 1) / 2) * TRACK_SPACING;
}

const STORAGE_KEY = 'levelcrossingcontroller.settings';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing, storage disabled, etc. - just don't persist.
  }
}
