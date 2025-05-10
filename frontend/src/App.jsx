import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import NavBar from './components/Navbar';
import Footer from './components/Footer';

import Dashboard from './pages/Dashboard';
import Files from './pages/Files';
import Login from './pages/Login';
import Node from './pages/Node';
import NotFound from './pages/NotFound';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import User from './pages/User';

import './index.css';

createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);

export default function App() {
	return (
		<BrowserRouter>
			<NavBar />
			<Routes>
				<Route path="/" element={<Dashboard />} />
				<Route path="/files" element={<Files />} />
				<Route path="/dashboard" element={<Dashboard />} />
				<Route path="/node/:id" element={<Node />} />
				<Route path="/user/:id" element={<User />} />
				<Route path="/login" element={<Login />} />
				<Route path="/privacy" element={<Privacy />} />
				<Route path="/terms" element={<Terms />} />
				<Route path="*" element={<NotFound />} />
			</Routes>
			<Footer />
		</BrowserRouter>
	);
}
