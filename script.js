(function () {
	/**
	 * Configurations
	 * you can change widget configuration from here
	 */
	const CONFIG = {
		url: 'https://mxc.instatus.com',
		frameUrl: 'https://mxc.instatus.com/widget',
		position: 'top-center',
		incident: {
			textColor: '#000000',
			backgroundColor: '#FFFFFF',
		},
		maintenance: {
			textColor: '#000000',
			backgroundColor: '#FFFFFF',
		},
		text: {"viewLatestUpdates":"View latest updates","lastUpdated":"Last updated {{time}} ago","scheduledFor":"Scheduled for","year":"year","years":"years","month":"month","months":"months","day":"day","days":"days","hour":"hour","hours":"hours","minute":"minute","minutes":"minutes"},
	};

	const isMobile = screen.width < 600;

	/**
	 * Initialization
	 */
	async function init() {
		while (true) {
			try {
				await fetchIssues();
			} catch {
			}
			await wait(3 * 60 * 1000); // every 3 minutes
		}
	}

	async function fetchIssues() {
		let result = await fetch(CONFIG.url + '/13076080/issues.json').then((res) => {
			if (res.ok) {
				return res.json();
			} else {
				return Promise.reject(res.statusText);
			}
		});

		let issues = [];

		result.activeIncidents?.forEach((incident) => {
			issues.push({
				type: 'incident',
				id: incident.id,
				status: incident.status,
				title:  incident.name, 
				updatedAt: incident.updatedAt,
				theme: CONFIG.maintenance,
				text: CONFIG.text,
			});
		});

		result.activeMaintenances?.forEach((maintenance) => {
			issues.push({
				type: 'maintenance',
				id: maintenance.id,
				status: maintenance.status,
				title: maintenance.name,
				updatedAt: maintenance.updatedAt,
				date: maintenance.date,
				theme: CONFIG.incident,
				text: CONFIG.text,
			});
		});

		notifyIssues(issues);
	}

	/**
	 * Frame
	 */

	let frames = [];
	let dismissedFrameIds = {};
	let closedFrames=[];
	let retreviedLocalClosedFrames = localStorage.getItem("closedFrames");
	let localClosedFrames = JSON.parse(retreviedLocalClosedFrames);

	function notifyIssues(issues) {
		frames.forEach((frame) => {
			let issue = issues.find((issue) => issue.id === frame.id);
			if (issue) {
				updateIssue(issue);
			} else {
				dismissIssue(frame.id);
			}
		});
		issues
			.filter((issue) => {
				let isDismissed = issue.id in dismissedFrameIds;
				let isOnScreen = frames.some((frame) => frame.id === issue.id);
				return !(isDismissed || isOnScreen);
			})
			.forEach((issue, i) => {
				notifyIssue({ issue, timeout: i * 200 });
			});
	}

	function notifyIssue({ issue, timeout }) {
		if (localStorage.hasOwnProperty('closedFrames') && localClosedFrames.includes(issue.id)) {
			return;
		}

		let frame = document.createElement('iframe');
		frame.id = issue.id;
		frame.src = CONFIG.frameUrl + '?url=' + encodeURIComponent(CONFIG.url + '/' + issue.id) + '&issue=' + encodeURIComponent(JSON.stringify(issue)) + '&type=' + issue.type;
		frame.style.position = 'fixed';
		frame.style.border = 'none';
		frame.style.boxShadow = '0 0 #0000, 0 0 #0000, 0 25px 50px -12px rgba(0, 0, 0, 0.25)'
		frame.style.zIndex = '9999';
		frame.style.transition = 'left .3s ease, bottom .3s ease, right .3s ease';

		let frameLength = frames.length;

		if (isMobile) {
			frame.style.height = '180px';
			frame.style.width = '100vw';
			frame.style.transition = 'bottom .3s ease';
			frame.style.borderRadius = 'none';
			frame.style.left = 0;
			frame.style.bottom = '-1000px';
		} else {
			frame.style.height = '180px';
			frame.style.width = '365px';
			frame.style.borderRadius = '1rem';
			let x = '-1000px';
			let y = 50 + frameLength * 210 + 'px';
			if (CONFIG.position === 'bottom-left') {
				frame.style.left = x;
				frame.style.bottom = y;
			} else if (CONFIG.position === 'bottom-right') {
				frame.style.right = x;
				frame.style.bottom = y;
			} else if (CONFIG.position === 'bottom-center') {
				frame.style.bottom = y;
				frame.style.left = 0;
				frame.style.right = 0;
				frame.style.margin = 'auto';
			} else if (CONFIG.position === 'top-left') {
				frame.style.left = x;
				frame.style.top = y;
			} else if (CONFIG.position === 'top-right') {
				frame.style.right = x;
				frame.style.top = y;
			} else if (CONFIG.position === 'top-center') {
				frame.style.top = y;
				frame.style.left = 0;
				frame.style.right = 0;
				frame.style.margin = 'auto';
			}
		}

		frame.onload = function (e) {
			let actions = {
				showFrame: function () {				

					if (isMobile) {
						frame.style.bottom = frameLength * 180 + 'px';
					} else {
						let x = '50px';
						if (CONFIG.position === 'bottom-left' || CONFIG.position === 'top-left') {
							frame.style.left = x;
						} else if (CONFIG.position === 'bottom-right' || CONFIG.position === 'top-right') {
							frame.style.right = x;
						}
					}
				},
				dismissFrame: function () {
					dismissIssue(issue.id);
				},
			};

			window.addEventListener(
				'message',
				function (event) {
					if (
						event.data.id === issue.id &&
						event.data.action &&
						actions.hasOwnProperty(event.data.action)
					) {
						actions[event.data.action](event.data);
					}
				},
				false,
			);

			// animation
			setTimeout(() => {
				actions.showFrame();
			}, timeout);
		};

		document.body.appendChild(frame);

		frames.push(frame);
	}

	function updateIssue(issue) {
		let frame = frames.find((frame) => frame.id === issue.id);
		let newSrc = CONFIG.frameUrl + '?url=' + encodeURIComponent(CONFIG.url + '/' + issue.id) + '&issue=' + encodeURIComponent(JSON.stringify(issue));
		if (newSrc !== frame.src) {
			frame.src = newSrc;
		}
	}

	function dismissIssue(id) {
		let frame = frames.find((frame) => frame.id === id);
		dismissedFrameIds[id] = true;
		
		closedFrames.push(id);	
		if (isMobile) {
			frame.style.bottom = '-1000px';
		} else {
			frame.style.left = '-1000px';
		}
		localStorage.setItem("closedFrames", JSON.stringify(closedFrames));
		setTimeout(() => {
			removeFrame(id);
		}, 200);
	}

	function removeFrame(id) {
		frames = frames.filter((frame) => {
			if (frame.id === id) {
				frame.remove();
				return false;
			}
			return true;
		});
		// reorder
		frames.forEach((frame, i) => {
			if (isMobile) {
				frame.style.bottom = i * 130 + 'px';
			} else {
				frame.style.bottom = 60 + i * 20 + i * 155 + 'px';
			}
		});
	}

	init();

	/**
	 * utils
	 */
	function wait(ms) {
		return new Promise((res) => setTimeout(res, ms));
	}
	})();
