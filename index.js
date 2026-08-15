/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import * as Sentry from '@sentry/react-native';

Sentry.init({
    dsn: 'https://bdac92d36b0fc144ecabb32cce75a5a6@o4510733151436800.ingest.de.sentry.io/4510783476138064',
    tracesSampleRate: 1.0,
    _experiments: {
        profilesSampleRate: 1.0,
    },
});

AppRegistry.registerComponent(appName, () => Sentry.wrap(App));
