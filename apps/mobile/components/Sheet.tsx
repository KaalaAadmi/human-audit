import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Keyboard, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

const win = () => Dimensions.get('window').height;
const PAD = 40;

/**
 * Bottom sheet: tap the dimmed area to close; drag the handle to stretch (up), shrink or close (down).
 * The sheet is always laid out at its stretched size and only slides (translateY), so up and down drags are the same
 * motion and nothing relayouts while the finger moves.
 * `onDismiss` (iOS only) fires once the close animation has finished.
 * `height` is the resting height as a fraction of the screen (0..1); omit it to fit the content. `dim` is the backdrop opacity.
 */
export function Sheet({ visible, onClose, onDismiss, height, dim = 0.85, children }: {
  visible: boolean; onClose: () => void; onDismiss?: () => void; height?: number; dim?: number; children: React.ReactNode;
}) {
  const H = win();
  const full = H * 0.94;
  const [natural, setNatural] = useState<number | null>(null); // content height, only used when `height` is omitted
  const rest = height ? Math.min(H * height, full) : natural === null ? null : Math.min(natural, full);
  const restY = rest === null ? H : full - rest; // translateY at the resting height (0 = fully stretched)

  const y = useRef(new Animated.Value(H)).current; // JS driven so stopAnimation() can read the current value synchronously
  const start = useRef(0);
  // The PanResponder is created once, so it reads the latest values through this ref.
  const live = useRef({ restY, onClose });
  live.current = { restY, onClose };

  useEffect(() => { if (visible && rest !== null) y.setValue(restY); }, [visible, rest, restY, y]);

  const to = (toValue: number, done?: () => void) =>
    Animated.spring(y, { toValue, useNativeDriver: false, bounciness: 0, speed: 14 }).start(done);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { y.stopAnimation((v) => { start.current = v; }); },
    onPanResponderMove: (_, g) => y.setValue(Math.min(win(), Math.max(0, start.current + g.dy))),
    onPanResponderRelease: (_, g) => {
      const { restY: r, onClose: close } = live.current;
      const pos = start.current + g.dy;
      const atRest = start.current >= r - 1;
      if (pos > r + 80 || (g.vy > 0.8 && atRest)) {
        Keyboard.dismiss();
        Animated.timing(y, { toValue: win(), duration: 160, useNativeDriver: false }).start(() => close());
      } else to(g.vy < -0.7 ? 0 : g.vy > 0.7 ? r : pos < r / 2 ? 0 : r);
    },
  })).current;

  const close = () => { Keyboard.dismiss(); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close} onDismiss={onDismiss}>
      <View style={[styles.overlay, { backgroundColor: `rgba(0,0,0,${dim})` }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        {/* Hidden until the resting position is known so a fit-to-content sheet never flashes stretched. */}
        <Animated.View style={[styles.sheet, { height: full, opacity: rest === null ? 0 : 1, transform: [{ translateY: y }] }]}>
          <View
            style={[height ? { flex: 1, paddingBottom: PAD + (full - rest!) } : { paddingBottom: PAD }, styles.body]}
            onLayout={height ? undefined : (e) => setNatural(e.nativeEvent.layout.height)}
          >
            <View style={styles.grab} {...pan.panHandlers} hitSlop={{ top: 10, bottom: 10 }}>
              <View style={styles.handle} />
            </View>
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.borderMachined },
  body: { paddingHorizontal: Spacing.xl },
  grab: { alignItems: 'center', paddingTop: Spacing.md, paddingBottom: Spacing.md },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.borderMachined },
});
