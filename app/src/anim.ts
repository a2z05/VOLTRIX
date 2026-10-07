/**
 * Motion recipes — one place so every entrance obeys the same spring feel
 * (state/hierarchy driven, never random).
 */
import {FadeInDown, FadeInUp} from 'react-native-reanimated';

/**
 * Staggered bento entrance: item `i` springs into place `i * step` ms after
 * the screen mounts (or after the last sibling, conceptually).
 */
export function bentoIn(index: number, step = 70) {
  return FadeInDown.delay(index * step)
    .springify()
    .damping(18)
    .stiffness(140)
    .mass(0.9);
}

/** Tab swap: content springs in from just above with a short head start. */
export function screenIn() {
  return FadeInDown.delay(25)
    .springify()
    .damping(20)
    .stiffness(170)
    .mass(0.9);
}

/** Header/banner drop-in — a touch snappier than content. */
export function chromeIn(delay = 0) {
  return FadeInUp.delay(delay)
    .springify()
    .damping(19)
    .stiffness(200)
    .mass(0.85);
}
