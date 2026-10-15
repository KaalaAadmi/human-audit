import React from 'react';
     import { StyleSheet, Text, View } from 'react-native';
     import { GlassCard } from '../components/GlassCard';
     import { Colors } from '../theme/colors';
     import { Typography } from '../theme/typography';
     import { Spacing } from '../theme/spacing';

     export default function HomeScreen() {
       return (
         <View style={styles.container}>
           <Text style={Typography.heroTitle}>HumanAudit</Text>
           <Text style={[Typography.caption, { marginTop: Spacing.xs, marginBottom: Spacing.xl }]}>
             Because your biological age is currently judging your life choices.
           </Text>

           <GlassCard style={{ width: '100%' }} borderColor="rgba(110, 231, 183, 0.2)">
             <Text style={Typography.metricLabel}>Daily Readiness</Text>
             <Text style={{ fontSize: 32, fontWeight: '800', color: Colors.readiness, marginVertical: Spacing.xs }}>
               88%
             </Text>
             <Text style={Typography.body}>Optimal Recovery • Phase 1 Verified</Text>
           </GlassCard>
         </View>
       );
     }

     const styles = StyleSheet.create({
       container: {
         flex: 1,
         backgroundColor: Colors.canvas,
         padding: Spacing.xl,
         justifyContent: 'center',
         alignItems: 'center',
       },
     });