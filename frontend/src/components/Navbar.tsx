import AOS from 'aos';
import 'aos/dist/aos.css';
import { useEffect, useState } from 'react';
import { LiaTimesSolid } from 'react-icons/lia';
import { MdMenu, MdMenuOpen } from 'react-icons/md';
import { NavLink } from 'react-router';
import { Link } from 'react-router-dom';

export default function NavBar() {
	useEffect(() => {
		AOS.init();
	}, []);

	const [sidebar, setSidebar] = useState(false);
	const [loginModalOpen, setLoginModalOpen] = useState(false);

	const openLoginModal = () => setLoginModalOpen(true);
	const closeLoginModal = () => setLoginModalOpen(false);

	const navClass = ({ isActive, isPending }) => (isPending || isActive ? 'active-path' : 'links');
	const pages = (
		<>
			<li>
				<NavLink to="/" className={navClass}>
					Home
				</NavLink>
			</li>
			<li>
				<NavLink to="/dashboard" className={navClass}>
					Dashboard
				</NavLink>
			</li>
		</>
	);
	const btns = (
		<>
			<>
				<button onClick={openLoginModal} className="text-white btn btn-sm btn-outline">
					Login
				</button>
			</>
		</>
	);

	return (
		<>
			<div className="navbar bg-[#1a1a1a] lg:px-24 px-4">
				<div className="navbar-start">
					<Link to="/" className="text-3xl font-bold leading-6 text-white lg:text-3xl animate-fade-right animate-once">
						<span className="text-primary">R</span>Storage
					</Link>
				</div>
				<div className="hidden lg:flex navbar-center animate-fade-up animate-once">
					<ul className="gap-2 px-2 text-white menu menu-horizontal">{pages}</ul>
				</div>
				<div className="navbar-end gap-x-4">
					<div className="hidden lg:flex gap-2 animate-fade-left animate-once">{btns}</div>
					<div className="flex lg:hidden cursor-pointer dropdown dropdown-end">
						<div onClick={() => setSidebar(true)} className="text-white">
							{sidebar ? <MdMenuOpen className="size-11" /> : <MdMenu className="size-11" />}
						</div>
					</div>
					{sidebar ? (
						<div data-aos="slide-left" className="absolute top-0 right-0 z-50 w-full h-screen overflow-x-hidden bg-white bg-opacity-10">
							<div
								data-aos="slide-left"
								data-aos-easing="ease-in-out"
								data-aos-delay="100"
								className="p-4 absolute w-[65%] top-0 right-0 h-screen bg-[#1a1a1a]"
							>
								<div className="flex items-center justify-between">
									<Link to="/" className="text-2xl font-bold leading-6 text-white lg:text-3xl animate-fade-right animate-once">
										<span className="text-primary">R</span>Storage
									</Link>
									<button
										onClick={() => setSidebar(false)}
										className="border-2 text-xl text-muted opacity-60 hover:opacity-100 font-bold p-3 bg-transparent rounded-full hover:bg-primary"
									>
										<LiaTimesSolid />
									</button>
								</div>

								<ul className="gap-2 px-2 text-white menu menu-vertical">{pages}</ul>
								<div className="flex flex-col gap-2 animate-fade-left animate-once">{btns}</div>
							</div>
						</div>
					) : (
						''
					)}
				</div>
			</div>

			{loginModalOpen && (
				<div tabIndex={-1} className="fixed inset-0 z-50 flex justify-center items-center w-full h-full bg-dark backdrop-blur-sm">
					<div className="relative p-8 w-full max-w-lg max-h-full rounded-lg shadow-lg bg-tertiary_light text-white space-y-6">
						<button
							onClick={closeLoginModal}
							className="absolute flex justify-center items-center top-8 right-8 text-4xl bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg w-8 h-8"
						>
							&times;
							<span className="sr-only">Close modal</span>
						</button>
						<div className="flex justify-center items-center">
							<h1 className="text-3xl font-bold">
								<span className="text-primary">R</span>Storage Login
							</h1>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
