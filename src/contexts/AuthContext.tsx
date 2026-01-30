import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

interface User {
    id: string;
    username: string;
}

interface GameData {
    goalDuckClicks: number;
    flappyHighScore: number;
    runnerHighScore: number;
}

interface AuthContextType {
    user: User | null;
    gameData: GameData;
    login: (username: string, password: string) => Promise<boolean>;
    register: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    updateGoalDuckClicks: (clicks: number) => Promise<void>;
    updateFlappyHighScore: (score: number) => Promise<void>;
    updateRunnerHighScore: (score: number) => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [gameData, setGameData] = useState<GameData>({ goalDuckClicks: 0, flappyHighScore: 0, runnerHighScore: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // No session persistence - always require login
        setIsLoading(false);
    }, []);

    const loadGameData = async (userId: string) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setGameData({
                    goalDuckClicks: data.gameData?.goalDuckClicks || 0,
                    flappyHighScore: data.gameData?.flappyHighScore || 0,
                    runnerHighScore: data.gameData?.runnerHighScore || 0
                });
            }
        } catch (error) {
            console.error('Error loading game data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            console.log('🔍 Attempting login for:', username);

            const userDoc = await getDoc(doc(db, 'users', username));
            console.log('📄 User document exists:', userDoc.exists());

            if (userDoc.exists()) {
                const data = userDoc.data();
                console.log('🔑 Password match:', data.password === password);

                if (data.password === password) {
                    const userData = { id: username, username };
                    setUser(userData);
                    await loadGameData(username);
                    console.log('✅ Login successful for:', username);
                    return true;
                }
            }
            console.log('❌ Login failed for:', username);
            setIsLoading(false);
            return false;
        } catch (error) {
            console.error('💥 Login error:', error);
            setIsLoading(false);
            return false;
        }
    };

    const register = async (username: string, password: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            const userDoc = await getDoc(doc(db, 'users', username));

            if (userDoc.exists()) {
                setIsLoading(false);
                return false; // Username already exists
            }

            await setDoc(doc(db, 'users', username), {
                username,
                password,
                createdAt: new Date(),
                gameData: {
                    goalDuckClicks: 0,
                    flappyHighScore: 0,
                    runnerHighScore: 0
                }
            });

            const userData = { id: username, username };
            setUser(userData);
            setGameData({ goalDuckClicks: 0, flappyHighScore: 0, runnerHighScore: 0 });
            setIsLoading(false);
            return true;
        } catch (error) {
            console.error('Register error:', error);
            setIsLoading(false);
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        setGameData({ goalDuckClicks: 0, flappyHighScore: 0, runnerHighScore: 0 });
    };

    const updateGoalDuckClicks = async (clicks: number) => {
        if (!user) return;

        try {
            await updateDoc(doc(db, 'users', user.id), {
                'gameData.goalDuckClicks': clicks
            });
            setGameData(prev => ({ ...prev, goalDuckClicks: clicks }));
        } catch (error) {
            console.error('Error updating Goal Duck clicks:', error);
        }
    };

    const updateFlappyHighScore = async (score: number) => {
        if (!user) return;

        try {
            await updateDoc(doc(db, 'users', user.id), {
                'gameData.flappyHighScore': score
            });
            setGameData(prev => ({ ...prev, flappyHighScore: score }));
        } catch (error) {
            console.error('Error updating Flappy high score:', error);
        }
    };

    const updateRunnerHighScore = async (score: number) => {
        if (!user) return;

        try {
            await updateDoc(doc(db, 'users', user.id), {
                'gameData.runnerHighScore': score
            });
            setGameData(prev => ({ ...prev, runnerHighScore: score }));
        } catch (error) {
            console.error('Error updating Duck Runner high score:', error);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            gameData,
            login,
            register,
            logout,
            updateGoalDuckClicks,
            updateFlappyHighScore,
            updateRunnerHighScore,
            isLoading
        }}>
            {children}
        </AuthContext.Provider>
    );
};
