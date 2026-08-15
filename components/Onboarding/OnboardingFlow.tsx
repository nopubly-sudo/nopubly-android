import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ScrollView,
} from 'react-native';

const { width } = Dimensions.get('window');

const colors = {
    bgDark: '#0A1628',
    neonGreen: '#00FF88',
    textPrimary: '#E0FFE0',
    textSecondary: '#8FA89F',
    cardBg: '#132238',
};

interface OnboardingFlowProps {
    onComplete: () => void;
    onShowPricing: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onShowPricing }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const slides = [
        {
            title: 'Protección Total',
            subtitle: 'Bloquea malware, ads y rastreadores automáticamente',
            icon: '▣',
        },
        {
            title: 'Navega Seguro',
            subtitle: 'VPN integrada protege tu privacidad en cualquier red',
            icon: '⚙',
        },
        {
            title: 'Escaneo Inteligente',
            subtitle: 'Detecta apps peligrosas antes de que te afecten',
            icon: '≡',
        },
        {
            title: 'Todo Listo',
            subtitle: 'Comienza a proteger tu dispositivo ahora',
            icon: '✓',
        },
    ];

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    const isLastSlide = currentSlide === slides.length - 1;

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                contentOffset={{ x: currentSlide * width, y: 0 }}
            >
                {slides.map((slide, index) => (
                    <View key={index} style={styles.slide}>
                        {/* Illustration Circle */}
                        <View style={styles.illustrationContainer}>
                            <View style={styles.illustrationCircle}>
                                <Text style={styles.illustrationIcon}>{slide.icon}</Text>
                            </View>
                        </View>

                        {/* Title & Subtitle */}
                        <Text style={styles.title}>{slide.title}</Text>
                        <Text style={styles.subtitle}>{slide.subtitle}</Text>
                    </View>
                ))}
            </ScrollView>

            {/* Dots Indicator */}
            <View style={styles.dotsContainer}>
                {slides.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            currentSlide === index && styles.dotActive,
                        ]}
                    />
                ))}
            </View>

            {/* Buttons */}
            <View style={styles.buttonsContainer}>
                {isLastSlide ? (
                    <>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={onComplete}
                        >
                            <Text style={styles.primaryButtonText}>Empieza Gratis</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={onShowPricing}
                        >
                            <Text style={styles.secondaryButtonText}>Ver Planes</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={nextSlide}
                        >
                            <Text style={styles.primaryButtonText}>Siguiente</Text>
                        </TouchableOpacity>

                        {currentSlide > 0 && (
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={prevSlide}
                            >
                                <Text style={styles.secondaryButtonText}>Atrás</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>

            {/* Skip Button */}
            {!isLastSlide && (
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={onComplete}
                >
                    <Text style={styles.skipButtonText}>Saltar</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    slide: {
        width,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    illustrationContainer: {
        marginBottom: 60,
    },
    illustrationCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: colors.cardBg,
        borderWidth: 3,
        borderColor: colors.neonGreen,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.neonGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 10,
    },
    illustrationIcon: {
        fontSize: 80,
        color: colors.neonGreen,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 18,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 26,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 40,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.textSecondary + '50',
        marginHorizontal: 4,
    },
    dotActive: {
        backgroundColor: colors.neonGreen,
        width: 24,
    },
    buttonsContainer: {
        paddingHorizontal: 40,
        marginBottom: 20,
    },
    primaryButton: {
        backgroundColor: colors.neonGreen,
        paddingVertical: 16,
        borderRadius: 25,
        marginBottom: 12,
    },
    primaryButtonText: {
        color: colors.bgDark,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    secondaryButton: {
        paddingVertical: 16,
    },
    secondaryButtonText: {
        color: colors.neonGreen,
        fontSize: 16,
        textAlign: 'center',
    },
    skipButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        padding: 10,
    },
    skipButtonText: {
        color: colors.textSecondary,
        fontSize: 16,
    },
});
