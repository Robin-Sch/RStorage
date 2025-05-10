import { Link } from 'react-router-dom';

import githubSvg from '../assets/footer/github.svg';

export default function Footer() {
	return (
		<>
			<footer className="bg-[#1a1a1a]">
				<div className="mx-auto w-full max-w-screen-xl p-4 py-6 lg:py-8">
					<div className="md:flex md:justify-between">
						<div className="grid grid-cols-2 gap-8 sm:gap-6 sm:grid-cols-2">
							<div>
								<h2 className="mb-6 text-sm font-semibold text-gray-900 uppercase dark:text-white">Legal</h2>
								<ul className="text-gray-500 dark:text-gray-400 font-medium">
									<li className="mb-4">
										<Link to="/privacy" className="link link-hover">
											Privacy Policy
										</Link>
									</li>
									<li>
										<Link to="/terms" className="link link-hover">
											Terms &amp; Conditions
										</Link>
									</li>
								</ul>
							</div>
						</div>
					</div>
					<hr className="my-6 border-gray-200 sm:mx-auto dark:border-gray-700 lg:my-8" />
					<div className="sm:flex sm:items-center sm:justify-between">
						<span className="text-sm text-gray-500 sm:text-center dark:text-gray-400">
							© 2025{' '}
							<Link to="/" className="link link-hover">
								RStorage
							</Link>
							. All Rights Reserved.
						</span>
						<div className="flex mt-4 sm:justify-center sm:mt-0">
							<Link to="/github" className="text-gray-500 hover:text-gray-900 dark:hover:text-white ms-5">
								<img className="w-5 h-5" aria-hidden="true" src={githubSvg} />
								<span className="sr-only">GitHub</span>
							</Link>
						</div>
					</div>
				</div>
			</footer>
		</>
	);
}
