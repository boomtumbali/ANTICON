import { createPlayer } from '@videojs/react';
import { videoFeatures } from '@videojs/react/video';

/** One store per <Player>: every ANTICON player on a page is independent. */
export const { Player, usePlayer } = createPlayer({ features: videoFeatures });
