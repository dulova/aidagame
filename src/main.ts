import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';
import { installTouchGuards } from './input/touchGuards';
installTouchGuards(document);
createApp(App).mount('#app');
