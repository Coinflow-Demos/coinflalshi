import {useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Svg, {G, Line as SvgLine, Path, Circle} from 'react-native-svg';
import {colors} from '@/constants/theme';

export interface PricePoint {
  priceCents: number;
  at: string;
}

export interface PriceSeries {
  id: string;
  label: string;
  color: string;
  points: PricePoint[];
}

const HEIGHT = 200;
const PADDING = {top: 8, right: 8, bottom: 8, left: 8};

/**
 * Custom SVG line chart mirroring web's PriceChart (components/charts/price-chart.tsx)
 * — recharts isn't usable in React Native, so this hand-rolls the same
 * merged-timestamp, 0-100¢ domain approach with react-native-svg primitives.
 */
export function PriceChart({series}: {series: PriceSeries[]}) {
  const [width, setWidth] = useState(0);

  const allTimestamps = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => new Date(p.at).getTime())))
  ).sort((a, b) => a - b);

  if (allTimestamps.length < 2 || width === 0) {
    return (
      <View
        style={styles.empty}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        <Text style={styles.emptyText}>Not enough price history yet.</Text>
      </View>
    );
  }

  const minT = allTimestamps[0];
  const maxT = allTimestamps[allTimestamps.length - 1];
  const innerWidth = width - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xForT = (t: number) =>
    PADDING.left + (maxT === minT ? 0 : ((t - minT) / (maxT - minT)) * innerWidth);
  const yForPrice = (cents: number) => PADDING.top + innerHeight * (1 - cents / 100);

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Svg width={width} height={HEIGHT}>
        {[0, 25, 50, 75, 100].map((gridValue) => (
          <SvgLine
            key={gridValue}
            x1={PADDING.left}
            x2={width - PADDING.right}
            y1={yForPrice(gridValue)}
            y2={yForPrice(gridValue)}
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}
        {series.map((s) => {
          if (s.points.length < 2) return null;
          const d = s.points
            .map((p, index) => {
              const x = xForT(new Date(p.at).getTime());
              const y = yForPrice(p.priceCents);
              return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
          const last = s.points[s.points.length - 1];
          return (
            <G key={s.id}>
              <Path d={d} stroke={s.color} strokeWidth={2} fill="none" />
              <Circle
                cx={xForT(new Date(last.at).getTime())}
                cy={yForPrice(last.priceCents)}
                r={3}
                fill={s.color}
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {color: colors.muted, fontSize: 13},
});
