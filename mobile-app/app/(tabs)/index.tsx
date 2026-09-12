import React, { useState, ComponentType, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/useAuth';
import { SvgIcon } from '@/components/ui/svg-icon';
import {
  CartIcon,
  BoxIcon,
  ListIcon,
  TrayIcon,
  ChartIcon,
  SettingsIcon,
} from '@/assets/icons';
import { SvgProps } from 'react-native-svg';

interface DashboardCard {
  title: string;
  description: string;
  icon: ComponentType<SvgProps>;
  route?: string;
  onPress?: () => void;
  color: string;
  available: boolean;
}

export default function DashboardScreen() {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Watch for authentication state changes and navigate if logged out
  useEffect(() => {
    if (!isAuthenticated && !isLoggingOut) {
      console.log('Dashboard: User is not authenticated, navigating to login...');
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoggingOut, router]);

  const performLogout = async () => {
    console.log('Logout confirmed, starting logout process...');
    setIsLoggingOut(true);
    try {
      console.log('Calling logout function...');
      await logout();
      console.log('Logout function completed');
      // State change will trigger useEffect to navigate
      // But also try direct navigation as backup
      setTimeout(() => {
        console.log('Navigating to login screen (backup)...');
        router.replace('/(auth)/login');
      }, 200);
    } catch (error) {
      // Even if logout fails, still navigate to login
      // The logout function should have cleared local state anyway
      console.error('Logout error:', error);
      setTimeout(() => {
        console.log('Navigating to login screen after error...');
        router.replace('/(auth)/login');
      }, 200);
    } finally {
      // Don't set isLoggingOut to false immediately
      // Let the navigation happen first
      setTimeout(() => {
        setIsLoggingOut(false);
      }, 500);
    }
  };

  const handleLogout = () => {
    console.log('Logout button clicked');
    
    // Use browser confirm on web, Alert on native
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        performLogout();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: performLogout,
          },
        ]
      );
    }
  };

  const canAccess = (permissions: string[]) => {
    if (!user) return false;
    return permissions.some(perm => user.permissions?.includes(perm) || false);
  };

  const dashboardCards: DashboardCard[] = [
    {
      title: 'POS Checkout',
      description: 'Process sales and transactions',
      icon: CartIcon,
      route: '/pos',
      color: '#007AFF',
      available: canAccess(['sale:create', 'sale:read']),
    },
    {
      title: 'Products',
      description: 'Browse and search products',
      icon: BoxIcon,
      route: '/products',
      color: '#34C759',
      available: canAccess(['product:read']),
    },
    {
      title: 'Sales History',
      description: 'View past transactions',
      icon: ListIcon,
      route: '/sales',
      color: '#FF9500',
      available: canAccess(['sale:read']),
    },
    {
      title: 'Inventory',
      description: 'Check stock levels',
      icon: TrayIcon,
      route: '/inventory',
      color: '#AF52DE',
      available: canAccess(['inventory:read']),
    },
    {
      title: 'Reports',
      description: 'View sales reports',
      icon: ChartIcon,
      route: '/reports',
      color: '#FF2D55',
      available: canAccess(['report:read']),
    },
    {
      title: 'Settings',
      description: 'Account and app settings',
      icon: SettingsIcon,
      route: '/settings',
      color: '#8E8E93',
      available: true,
    },
  ];

  const handleCardPress = (card: DashboardCard) => {
    if (!card.available) {
      Alert.alert('Access Denied', 'You do not have permission to access this feature.');
      return;
    }

    if (card.onPress) {
      card.onPress();
    } else if (card.route) {
      // For now, show coming soon for routes that don't exist yet
      Alert.alert('Coming Soon', `${card.title} feature will be available soon.`);
      // router.push(card.route);
    }
  };

  const getRoleDisplayName = (role: string) => {
    const roleMap: Record<string, string> = {
      owner: 'Owner',
      manager: 'Manager',
      cashier: 'Cashier',
    };
    return roleMap[role] || role;
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <ThemedView style={styles.header}>
          <View>
            <ThemedText type="title" style={styles.welcomeText}>
              Welcome back{user?.name ? `, ${user.name}` : ''}!
            </ThemedText>
            {user && (
              <ThemedText style={styles.roleText}>
                {getRoleDisplayName(user.role)} • {user.tenantId}
              </ThemedText>
            )}
          </View>
        </ThemedView>

        {/* Quick Stats (Placeholder for future) */}
        {user?.role === 'owner' || user?.role === 'manager' ? (
          <ThemedView style={styles.statsContainer}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Today&apos;s Overview
            </ThemedText>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <ThemedText style={styles.statValue}>--</ThemedText>
                <ThemedText style={styles.statLabel}>Sales</ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statValue}>--</ThemedText>
                <ThemedText style={styles.statLabel}>Transactions</ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statValue}>--</ThemedText>
                <ThemedText style={styles.statLabel}>Revenue</ThemedText>
              </View>
            </View>
          </ThemedView>
        ) : null}

        {/* Dashboard Cards */}
        <ThemedView style={styles.cardsContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Quick Access
          </ThemedText>
          <View style={styles.cardsGrid}>
            {dashboardCards.map((card, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.card,
                  !card.available && styles.cardDisabled,
                ]}
                onPress={() => handleCardPress(card)}
                disabled={!card.available}
                activeOpacity={0.7}
              >
                <View style={[styles.cardIconContainer, { backgroundColor: `${card.color}20` }]}>
                  <SvgIcon
                    svg={card.icon}
                    size={32}
                    color={card.available ? card.color : '#8E8E93'}
                  />
                </View>
                <ThemedText style={styles.cardTitle}>{card.title}</ThemedText>
                <ThemedText style={[styles.cardDescription, !card.available && styles.cardDescriptionDisabled]}>
                  {card.description}
                </ThemedText>
                {!card.available && (
                  <ThemedText style={styles.cardLocked}>Locked</ThemedText>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ThemedView>

        {/* Logout Button */}
        <ThemedView style={styles.footer}>
          <TouchableOpacity
            style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ThemedText style={styles.logoutButtonText}>Logging out...</ThemedText>
            ) : (
              <ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
            )}
          </TouchableOpacity>
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
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roleText: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  cardsContainer: {
    marginBottom: 24,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  cardDescriptionDisabled: {
    opacity: 0.5,
  },
  cardLocked: {
    fontSize: 10,
    color: '#FF3B30',
    marginTop: 4,
    fontWeight: '600',
  },
  footer: {
    marginTop: 16,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
