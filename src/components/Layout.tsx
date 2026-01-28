import React, { type ReactNode } from 'react';
import Navbar from './Navbar';

interface LayoutProps {
    children: ReactNode;
    toggleTheme: (theme: string) => void;
    currentTheme: string;
}

const Layout: React.FC<LayoutProps> = ({ children, toggleTheme, currentTheme }) => {
    return (
        <>
            <Navbar toggleTheme={toggleTheme} currentTheme={currentTheme} />
            <div className="main-content-wrapper" style={{ paddingTop: '80px' }}>
                {children}
            </div>
        </>
    );
};

export default Layout;
