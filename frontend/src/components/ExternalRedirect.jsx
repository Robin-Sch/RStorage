import { string } from 'prop-types';
import { useEffect } from 'react';

export default function ExternalRedirect({ url }) {
	useEffect(() => {
		window.location.href = url;
	}, [url]);

	return null;
}

ExternalRedirect.propTypes = {
	url: string.isRequired,
};
