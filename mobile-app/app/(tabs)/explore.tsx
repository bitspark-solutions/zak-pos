import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/useAuth';
import { SvgIcon } from '@/components/ui/svg-icon';
import { ListIcon } from '@/assets/icons';

export default function SalesScreen() {
  const { user } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Sales History
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            View your recent transactions
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.emptyState}>
          <SvgIcon
            svg={ListIcon}
            size={64}
            color="#8E8E93"
            style={styles.emptyIcon}
          />
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            No Sales Yet
          </ThemedText>
          <ThemedText style={styles.emptyDescription}>
            Your sales transactions will appear here once you start processing orders.
          </ThemedText>
        </ThemedView>

        {/* Placeholder for future sales list */}
        <ThemedView style={styles.infoBox}>
          <ThemedText style={styles.infoText}>
            💡 Sales history feature coming soon. This will show:
          </ThemedText>
          <View style={styles.infoList}>
            <ThemedText style={styles.infoItem}>• Recent transactions</ThemedText>
            <ThemedText style={styles.infoItem}>• Daily/weekly summaries</ThemedText>
            <ThemedText style={styles.infoItem}>• Payment method breakdown</ThemedText>
            <ThemedText style={styles.infoItem}>• Refund and return history</ThemedText>
          </View>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '600',
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 20,
  },
});
