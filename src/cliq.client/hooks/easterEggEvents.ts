import { EventEmitter } from 'expo-modules-core';

export const EASTER_EGG_DISCOVERED = 'EASTER_EGG_DISCOVERED';

type EasterEggEventsMap = {
    [EASTER_EGG_DISCOVERED]: (easterEggId: string) => void;
};

export const easterEggEvents = new EventEmitter<EasterEggEventsMap>();
