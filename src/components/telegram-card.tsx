// ─── Telegram Connect Card ───────────────────────────────────────────────────
// Shows Telegram linking status with step-by-step guide if not linked

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { GlassCard } from '@/components/ui/glass-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { AppColors, BorderRadius, FontSizes, Spacing } from '@/constants/theme';

interface TelegramCardProps {
  chatId: string | null;
  linkToken: string | null;
}

export function TelegramCard({ chatId, linkToken }: TelegramCardProps) {
  const isLinked = !!chatId;

  return (
    <GlassCard glowColor={isLinked ? AppColors.accentBlue : undefined}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.icon}>✈️</Text>
          <Text style={styles.title}>Telegram Alerts</Text>
        </View>
        <StatusBadge
          label={isLinked ? 'Connected' : 'Not Linked'}
          color={isLinked ? AppColors.emerald : AppColors.textMuted}
          size="sm"
        />
      </View>

      {isLinked ? (
        <View style={styles.linkedContainer}>
          <Text style={styles.linkedText}>
            Your Telegram account is connected. You will receive water alerts directly in your chat.
          </Text>
          <View style={styles.chatIdRow}>
            <Text style={styles.chatIdLabel}>Chat ID:</Text>
            <Text style={styles.chatIdValue}>{chatId}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.guideContainer}>
          <Text style={styles.guideTitle}>Link your Telegram to receive alerts:</Text>

          <StepItem number={1} text="Open bot @tastTestwaterbot in Telegram" />
          <StepItem number={2} text={`Send command: /link ${linkToken ?? '<TOKEN>'}`} />
          <StepItem number={3} text="You'll receive a confirmation message" />

          {linkToken && (
            <View style={styles.tokenContainer}>
              <Text style={styles.tokenLabel}>Your Link Token:</Text>
              <View style={styles.tokenBox}>
                <Text style={styles.tokenValue} selectable>
                  {linkToken}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.openButton}
            onPress={() => Linking.openURL('https://t.me/tastTestwaterbot')}
            activeOpacity={0.7}>
            <Text style={styles.openButtonIcon}>✈️</Text>
            <Text style={styles.openButtonText}>Open Telegram Bot</Text>
          </TouchableOpacity>
        </View>
      )}
    </GlassCard>
  );
}

function StepItem({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  linkedContainer: {
    gap: Spacing.sm,
  },
  linkedText: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  chatIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  chatIdLabel: {
    fontSize: FontSizes.sm,
    color: AppColors.textMuted,
  },
  chatIdValue: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.accentBlue,
    fontFamily: 'monospace',
  },
  guideContainer: {
    gap: Spacing.md,
  },
  guideTitle: {
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AppColors.accentBlue + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    color: AppColors.accentBlue,
  },
  stepText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  tokenContainer: {
    marginTop: Spacing.sm,
  },
  tokenLabel: {
    fontSize: FontSizes.xs,
    color: AppColors.textMuted,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tokenBox: {
    backgroundColor: AppColors.bgSecondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: AppColors.bgInputBorder,
  },
  tokenValue: {
    fontSize: FontSizes.sm,
    fontFamily: 'monospace',
    color: AppColors.accentBlueBright,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: AppColors.accentBlue + '20',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: AppColors.accentBlue + '30',
  },
  openButtonIcon: {
    fontSize: 16,
  },
  openButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: AppColors.accentBlue,
  },
});
