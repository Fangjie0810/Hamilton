import './style.css';
import { showStartupError } from './ui/startupError';
const params = new URLSearchParams(window.location.search);
// Retired bookmarks enter the one supported story, preserving other preferences.
if (params.get('story') === '2d') {
  params.set('story', '3d');
  history.replaceState(null, '', `${location.pathname}?${params}${location.hash}`);
}
if (params.get('experience') === '3d') {
  void import('./sceneExperience/Experience').then(({ startExperience }) => startExperience()).catch(showStartupError);
} else if (params.get('demo') === '3d' || params.get('story') === '3d') {
  void import('./demo3d/Demo').then(({ startDemo }) => startDemo()).catch(showStartupError);
} else {
  void import('./ui/EntryScreen').then(({ showEntryScreen }) => showEntryScreen()).catch(showStartupError);
}
