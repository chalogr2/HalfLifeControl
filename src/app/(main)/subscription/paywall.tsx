import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Typography, Button } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import type { PurchasesPackage } from 'react-native-purchases';

const FEATURES = [
  {
    title: 'Unlimited scheduled pills',
    description: 'Free users are limited to 1 scheduled pill.',
  },
  {
    title: 'Unlimited random tracking',
    description: 'Track as many as-needed doses as you like.',
  },
  {
    title: 'Future features sync',
    description: 'Includes Apple Watch & Apple Health integration.',
  },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { packages, purchase, restore } = useSubscriptionStore();
  const [selectedPkg, setSelectedPkg] = useState<PurchasesPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  // Find annual, monthly, and lifetime packages
  const annualPkg = packages.find((p) => p.packageType === 'ANNUAL') ?? null;
  const monthlyPkg = packages.find((p) => p.packageType === 'MONTHLY') ?? null;
  const lifetimePkg = packages.find((p) => p.packageType === 'LIFETIME') ?? null;

  // Default to annual if available — it's the BEST VALUE tier we want to
  // drive. Falls back to monthly, then lifetime if those aren't configured.
  const activePkg = selectedPkg ?? annualPkg ?? monthlyPkg ?? lifetimePkg;

  const handlePurchase = useCallback(async () => {
    if (!activePkg) {
      Alert.alert(
        'Not Available',
        'Subscriptions are not yet configured. Check back soon!',
      );
      return;
    }
    setPurchasing(true);
    try {
      await purchase(activePkg);
      router.back();
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Error', e.message || 'Purchase failed.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [activePkg, purchase, router]);

  const handleRestore = useCallback(async () => {
    setPurchasing(true);
    try {
      await restore();
      Alert.alert('Restored', 'Your purchases have been restored.');
      router.back();
    } catch {
      Alert.alert('Error', 'Could not restore purchases.');
    } finally {
      setPurchasing(false);
    }
  }, [restore, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Typography variant="titleMd" color="primary">HalfLifeControl</Typography>
          <View style={styles.proBadge}>
            <Typography variant="labelSm" color="onPrimary">PRO</Typography>
          </View>
        </View>

        {/* Hero */}
        <Typography variant="headlineLg" style={styles.headline}>
          Get the most out of HalfLifeControl
        </Typography>
        <Typography variant="bodyLg" color="onSurfaceVariant" style={styles.subtitle}>
          Track your entire pill stack with a Pro subscription.
        </Typography>

        {/* Features */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.checkCircle}>
                <Typography variant="labelSm" color="onPrimary">✓</Typography>
              </View>
              <View style={styles.featureContent}>
                <Typography variant="titleSm">{f.title}</Typography>
                <Typography variant="bodyMd" color="onSurfaceVariant">
                  {f.description}
                </Typography>
              </View>
            </View>
          ))}
        </View>

        {/* Plan cards */}
        <View style={styles.plans}>
          {/* Annual */}
          <Pressable
            style={[
              styles.planCard,
              activePkg === annualPkg && styles.planCardActive,
            ]}
            onPress={() => setSelectedPkg(annualPkg)}
            accessibilityRole="radio"
            accessibilityState={{ selected: activePkg === annualPkg }}
            accessibilityLabel={`Annual plan, ${annualPkg ? annualPkg.product.priceString : '$39.99'} per year, best value`}
          >
            <View style={styles.bestValueBadge}>
              <Typography variant="labelSm" color="onPrimary">BEST VALUE</Typography>
            </View>
            <View style={styles.planRow}>
              <View style={styles.radioOuter}>
                {activePkg === annualPkg && <View style={styles.radioInner} />}
              </View>
              <View style={styles.planInfo}>
                <Typography variant="titleMd">Annual Plan</Typography>
                <Typography variant="labelMd" color="onSurfaceVariant">
                  {annualPkg ? annualPkg.product.priceString : '$39.99'}/year
                </Typography>
              </View>
              <View style={styles.planPrice}>
                <Typography variant="headlineMd" color="primary">
                  {annualPkg
                    ? `$${(annualPkg.product.price / 12).toFixed(2)}`
                    : '$3.33'}
                </Typography>
                <Typography variant="labelSm" color="onSurfaceVariant">/month</Typography>
              </View>
            </View>
          </Pressable>

          {/* Monthly */}
          <Pressable
            style={[
              styles.planCard,
              activePkg === monthlyPkg && styles.planCardActive,
            ]}
            onPress={() => setSelectedPkg(monthlyPkg)}
            accessibilityRole="radio"
            accessibilityState={{ selected: activePkg === monthlyPkg }}
            accessibilityLabel={`Monthly plan, ${monthlyPkg ? monthlyPkg.product.priceString : '$4.99'} per month, cancel anytime`}
          >
            <View style={styles.planRow}>
              <View style={styles.radioOuter}>
                {activePkg === monthlyPkg && <View style={styles.radioInner} />}
              </View>
              <View style={styles.planInfo}>
                <Typography variant="titleMd">Monthly Plan</Typography>
                <Typography variant="labelMd" color="onSurfaceVariant">
                  Cancel anytime
                </Typography>
              </View>
              <View style={styles.planPrice}>
                <Typography variant="headlineMd" color="primary">
                  {monthlyPkg ? monthlyPkg.product.priceString : '$4.99'}
                </Typography>
                <Typography variant="labelSm" color="onSurfaceVariant">/month</Typography>
              </View>
            </View>
          </Pressable>

          {/* Lifetime — one-time purchase. Tertiary-amber accent on the
              ONE-TIME tag matches the third pill color in PILL_COLORS,
              keeping the palette coherent with the rest of the app. */}
          <Pressable
            style={[
              styles.planCard,
              activePkg === lifetimePkg && styles.planCardActive,
            ]}
            onPress={() => setSelectedPkg(lifetimePkg)}
            accessibilityRole="radio"
            accessibilityState={{ selected: activePkg === lifetimePkg }}
            accessibilityLabel={`Lifetime plan, ${lifetimePkg ? lifetimePkg.product.priceString : '$99.99'} one-time payment`}
          >
            <View style={styles.oneTimeBadge}>
              <Typography variant="labelSm" color="onPrimary">ONE-TIME</Typography>
            </View>
            <View style={styles.planRow}>
              <View style={styles.radioOuter}>
                {activePkg === lifetimePkg && <View style={styles.radioInner} />}
              </View>
              <View style={styles.planInfo}>
                <Typography variant="titleMd">Lifetime Plan</Typography>
                <Typography variant="labelMd" color="onSurfaceVariant">
                  Pay once, own forever
                </Typography>
              </View>
              <View style={styles.planPrice}>
                <Typography variant="headlineMd" color="primary">
                  {lifetimePkg ? lifetimePkg.product.priceString : '$99.99'}
                </Typography>
                <Typography variant="labelSm" color="onSurfaceVariant">one-time</Typography>
              </View>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom CTAs */}
      <View style={styles.bottomBar}>
        <Button
          title="Upgrade to Pro →"
          onPress={handlePurchase}
          loading={purchasing}
        />
        <View style={styles.bottomLinks}>
          <Pressable
            onPress={handleRestore}
            accessibilityRole="button"
            accessibilityLabel="Restore purchase"
          >
            <Typography variant="labelMd" color="primary">Restore purchase</Typography>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Continue with free plan"
          >
            <Typography variant="labelMd" color="onSurfaceVariant">Continue with Free</Typography>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[4],
    marginBottom: spacing[6],
  },
  proBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  headline: {
    marginBottom: spacing[2],
  },
  subtitle: {
    marginBottom: spacing[8],
    maxWidth: 300,
  },
  features: {
    gap: spacing[5],
    marginBottom: spacing[8],
  },
  featureRow: {
    flexDirection: 'row',
    gap: spacing[4],
    alignItems: 'flex-start',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
    gap: 2,
  },
  plans: {
    gap: spacing[3],
  },
  planCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    padding: spacing[4],
    overflow: 'hidden',
  },
  planCardActive: {
    borderColor: colors.primary,
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.secondary,
    borderBottomLeftRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  oneTimeBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.tertiary,
    borderBottomLeftRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  planInfo: {
    flex: 1,
    gap: 2,
  },
  planPrice: {
    alignItems: 'flex-end',
  },
  bottomBar: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    paddingTop: spacing[3],
    backgroundColor: colors.surface,
    gap: spacing[3],
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
