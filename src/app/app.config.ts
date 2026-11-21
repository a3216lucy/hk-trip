import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ConfirmationService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

// 色票：#202C39 #283845 #B8B08D #F2D492 #F29559（coolors 色票）；其餘色階為推算。
const HkPreset = definePreset(Aura, {
  primitive: {
    borderRadius: { none: '0', xs: '2px', sm: '4px', md: '6px', lg: '10px', xl: '14px' },
  },
  semantic: {
    primary: {
      50: '#F1F4F7', 100: '#DCE3EA', 200: '#B9C6D2', 300: '#8A9BAD', 400: '#5C6F82',
      500: '#3A4C5E', 600: '#283845', 700: '#202C39', 800: '#18212B', 900: '#10161D', 950: '#0A0E12',
    },
    focusRing: { width: '2px', style: 'solid', color: '#F29559', offset: '2px' },
    colorScheme: {
      light: {
        primary: { color: '{primary.600}', contrastColor: '#ffffff', hoverColor: '{primary.700}', activeColor: '{primary.800}' },
        surface: {
          0: '#ffffff', 50: '#FAF9F5', 100: '#F6F4EC', 200: '#E6E2D3', 300: '#D5D0BC', 400: '#948E72',
          500: '#5E6B78', 600: '#475563', 700: '#202C39', 800: '#18212B', 900: '#10161D', 950: '#0A0E12',
        },
      },
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    ConfirmationService,
    providePrimeNG({
      theme: {
        preset: HkPreset,
        options: { darkModeSelector: '.app-dark', cssLayer: { name: 'primeng', order: 'theme, base, primeng' } },
      },
    }),
  ],
};
