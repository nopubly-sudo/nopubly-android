import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import LogService from '../../services/LogService';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        LogService.reportError(error, true);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView style={styles.container}>
                    <View style={styles.content}>
                        <Text style={styles.icon}>⚠️</Text>
                        <Text style={styles.title}>¡Ups! Algo salió mal</Text>
                        <Text style={styles.subtitle}>
                            Hemos detectado un error técnico. El equipo de Nopubly ha sido notificado automáticamente.
                        </Text>

                        <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                            <Text style={styles.buttonText}>Intentar de Nuevo</Text>
                        </TouchableOpacity>

                        <Text style={styles.errorText}>
                            {this.state.error?.message}
                        </Text>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A1628',
    },
    content: {
        flex: 1,
        padding: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        fontSize: 80,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#00FF88',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#8FA89F',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 24,
    },
    button: {
        backgroundColor: '#00FF88',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 30,
    },
    buttonText: {
        color: '#0A1628',
        fontWeight: 'bold',
        fontSize: 16,
    },
    errorText: {
        marginTop: 20,
        fontSize: 12,
        color: '#FF3B30',
        opacity: 0.5,
    }
});
