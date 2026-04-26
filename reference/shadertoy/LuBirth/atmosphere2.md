/*
 *   \___ \  ___   \___    \___ \  ___      \___   \      \  \  ___  \  ___ \  ___
 *  \_     \    \_\    \  \      \         \        \      \  \    \  \      \    \_
 *    \___  \  __  \  ___  \      \  __     \    \_  \      \  \    \  \  __  \  __
 *        \_ \      \    \  \_     \         \_    \_ \      \  \    \_ \      \   \
 *    \_____  \_     \_   \_  \____ \_____     \_____  \_____ \_ \____   \_____ \_   \_
 *
 *   \__________________________________________________________________________________
 *
 *
 *	                                                     SPACE GLIDER SHADERTOY EDITION
 *                                                                 by Christian Schüler
 *			                                                            (c) 2001 - 2025
 *
 * Part 6 of 6: Image shader (postprocess, HMD and text overlay)
 * This software comes with no warranty. Use it at your own risk.
 * v 45
 *
 * ----------------------------------------------------------------------------
 *
 * You fly the 'Super-XR 7000' spaceplane around a small planet.
 * Select a start location by pressing the corresponding key.
 * After watching the transfer sequence you are free to go.
 *
 *
 * Controls
 * --------
 *
 *		mouse				Mouse look
 *		backspace			Forward look
 *
 *		shift + 1..4		Subsample resolution (100%,67%,50%,33%)
 *
 *		TAB					Menu (press again to dismiss)
 *		M					Map view
 *
 *		up/down				Pitch control
 *		up/down + alt/ctrl	Pitch trim (for aero controls only)
 *		left/right			Roll control
 *		A/D or Q/D			Yaw control or wheel steering
 *		W/S or Z/S			Throttle control (with stops at 15%, 35% and 70%)
 *
 *		(pressing shift gives finer controls for all of the above)
 *
 *		F					Move flaps down one notch
 *		F + shift			Move flaps up one notch
 *		V					Toggle spoilers (airbrakes)
 *		G					Toggle landing gear
 *		L					Toggle landing lights
 *		C					Toggle canopy
 *		B					Hold wheel brakes
 *		B + shift			Hold wheel brakes (less effort)
 *		space				Halt (Cut throttle and apply brakes)
 *
 *		< or `				Rotate thrust vector up one latch
 *		< or ` + shift		Rotate thrust vector down one latch
 *
 *		R					Increase image magnification
 *		R + shift			Decrease image magnification
 *		H					Increase overlay brightness
 *		H + shift			Decrease overlay brightness
 *		N					Toggle photo multiplier overlay ('night vision')
 *		T					Toggle terrain radar overlay
 *		I					Toggle J-band infrared image
 *
 *		backspace			reset view
 *		NUM 8				view forward
 *		NUM 4				view left
 *		NUM 6				view right
 *		NUM 2				view back
 *
 *		P					'dynamic pause' mode
 *		F1					Time acceleration up to ×10
 *		F2					Time acceleration up to ×100
 *		F3					Time acceleration up to ×1000
 *		F4					Time acceleration up to ×10000 (only in space)
 *		F5					Refresh scene objects
 *		F7					Rotate planet +15° (= one hour later in local time)
 *		F8					Rotate planet -15° (= one hour earlier in local time)
 *		F10					Debug Menu
 *		F12					CHEESE mode (hide all text and HMD overlays)
 *
 *	When in map view
 *
 *		TAB					Menu
 *		M					Exit map view
 *
 *		W/S or Z/S			zoom
 *		mouse drag			move/pan
 *		mouse click			set marker position
 *								- double click to remove
 *								- convert marker to waypoint via menu item 6
 *		backspace			reset position
 *
 *
 * Menu: Info pages
 * ----------------
 *	Info pages can be selected via menu item 1.
 *
 *	Location info:
 *		Shows current position.
 *		Latitude (lat), longitude (long), altitude (alt), heading (hdg).
 *
 *	Waypoint info:
 *		Shows relation to the selected waypoint.
 *		Bearing (brg), slant range (dst), height difference (delta-h),
 *		estimated time to arrival (eta).
 *
 *	Orbit info:
 *		Shows continuously updated orbital elements.
 *		Apoapsis (Ap), periapsis (Pe), eccentricity (e),
 *		true anomaly (theta, disabled at zero e).
 *
 *	Glide info:
 *		Shows continuously updated aerodynamic coefficients.
 *		Lift (CL) and drag (CD) coefficient, glide ratio (L/D),
 *		angle of attack (alpha).
 *
 *	HMD info:
 *		Shows contextual information depending on the selected HMD.
 *
 *	Static air info:
 *		Shows current static air data (velocity independent).
 *		Temperature (T), pressure (P), density (rho), Knudsen
 *      number (Kn).
 *
 *	Dynamic air info:
 *		Shows current dynamic air data (velocity dependent).
 *		Total temperature (Tt), total pressure (Pt), Reynolds number (Re),
 *		Mach number (Ma).
 *
 *  Temperature info:
 *      Shows all data related to temperature in one page.
 *      Static temperature (T), total temperature (Tt), instantaneous
 *      wall temperature (Tw), effective heating rate (qdot).
 *
 *	Time info:
 *		Shows current in-game date (year-day), in-game time (h:min:s),
 *		local time with timezone (h:min), current frame time (ms).
 *      The ingame time scale is defined by the constant SECONDS_PER_MINUTE
 *      in the common tab.
 *
 *
 * Menu: HMD modes
 * ---------------
 *	Modes for the helmet mounted display (HMD) can be selected via menu item 2.
 *
 *	HMD off:
 *		HMD overlay is disabled.
 *
 *	Surface overlay:
 *		Shows speed and flight path relative to the local surface
 *		and a pitch ladder oriented to the local horizon.
 *
 *		left group		speed in m/s, mach number (M), dyn. pressure in bars (Q)
 *		right group		altitude in meters and vertical speed in m/s
 *		top group		heading in degrees and vertical acc. in g units (G)
 *		bottom group	wall temperature at the stagnation point (front nose)
 *
 *		pitch ladder	major ticks every 10°, minor ticks every 5°
 *						surface only: one tick at -3° for landing
 *		_	 _
 *		 \/\/			Water line
 *						(direction of the body-fixed x axis)
 *		  .
 *		--O--			Flight path marker
 *						(direction of the velocity vector)
 *
 *		\  /
 *		 \/				Waypoint (if set)
 *
 *	Orbit overlay:
 *		Same as surface mode but speed and flight path are shown relative
 *		to the orbit center of mass (local planet) with additional
 *		markers that indicate the outcome of applying thrust in the
 *		given direction:
 *
 *		+Pe or -Pe		change only Pe, leave Ap unchanged
 *		+Ap or -Ap		change only Ap, leave Pe unchanged
 *		+a  or -a		change only a, leave e unchanged
 *		+e  or -e		change only e, leave a unchanged
 *		+h  or -h		change obital inclination
 *
 *		---	  ---		a pair of dashed lines (when they appear) indicate the
 *						pitch angle at which the current engine thrust will
 *						exactly counter gravity
 *
 *  Ascent overlay:
 *      tbd
 *
 *  Entry overlay:
 *      tbd
 *
 *  Landing overlay:
 *      tbd
 *
 *
 * Menu: Aero modes
 * ----------------
 *	Operating modes for the aerodynamic control surfaces (elevator, aileron and
 *	rudder) can be selected from menu item 3.
 *
 *	Aero off:
 *		Aero control is disabled, but manual trim setting is preserved.
 *
 *	Direct manual control:
 *		Pitch, roll and yaw inputs are directly connected to elevator, aileron
 *		and rudder.
 *
 *	Fly by wire control (experimental):
 *		Automatic controller where pitch input commands a desired g-load (-3..9)
 *		and roll input commands roll rate. Yaw input is still manual.
 *
 *
 * Menu: RCS modes
 * ----------------
 *	Operating modes for the reaction control system (RCS) can be selected from
 *	menu item 4.
 *
 *	RCS off:
 *		RCS control is disabled.
 *
 *	Direct manual control:
 *		Pitch, roll and yaw inputs are directly connected to the corresponding
 *		thrusters.
 *
 *	Rotation rate control:
 *		Pitch, roll and yaw inputs command rotation rates in the inertial
 *		reference frame.
 *
 *	Rotation rate control + LVLH:
 *		Pitch, roll and yaw inputs command rotation rates relative to
 *		the LVLH reference frame (local vertical, local horizon).
 *
 *
 * Menu: Engine modes
 * ------------------
 *	Engine modes can be selected from menu item 5.
 *
 *	Engine off:
 *		All engines are disabled.
 *
 *	Drive engine:
 *		An electical motor connected to the wheels.
 *		Provides passive wheel braking.
 *
 *	Impulse engine:
 *		A hypothetical propellant-less propulsion engine.
 *
 *	Nova engine:
 *		Not yet implemented.
 *
 *
 * Debug Menu: Graphs
 * ------------------
 *	Graphs can be selected from the debug menu item 2.
 *
 *	CL,CD,Cm:
 *		Shows continuously updated cofficients CL (yellow),
 *		CD (blue) and Cm (red) versus angle of attack.
 *		The current aoa is indicated by a green vertical.
 *
 *	CQb, Clb, Cnb:
 *		Shows continuously updated coeffcients CQb (yellow),
 *		Clb (blue) and Cnb (red) similarly.
 *
 *
 * Debug Menu: Buffers
 * -------------------
 *	Buffers can be selected from the debug menu item 3.
 *	These correspond to the shader buffers A to C and have several
 *	options (see modes below).
 *
 *
 * Debug Menu: Buffer modes
 * ------------------------
 *	Buffer modes can be selected from the debug menu item 4.
 *	They only have an effect if a buffer display is active.
 *
 *	For buffer A:
 *		Does not support modes at the moment.
 *
 *	For buffer B:
 *		Terrain slope (1), terrain world normal (2), terrain zone index (3),
 *		terrain elevation (4), terrain shadow umbra (5), text processing (6)
 *
 *	For buffer C:
 *		Entire buffer (1), atmosphere inscatter (2), atmosphere reflection (3),
 *      atmosphere skylight (4), skylight samples for objects (5)
 *
 *
 * How to fly
 * ----------
 *
 *	The simulated plane is a blend between an F16 and a Space Shuttle.
 *	Full throttle gives a thrust-to-weight ratio of 130%.
 *
 *	Reference speeds:
 *
 *		Speed is shown in the HMD in m/s relative the selected frame of reference.
 *		This is either true ground speed (in surface mode) or inertial speed
 *		(in orbit mode). The following reference speeds (at sea level) can be
 *		given for atmospheric flight.
 *
 *			stall speed				40 m/s
 *			landing speed			60 m/s .. 70 m/s
 *			best glide speed		89 m/s
 *
 *		Airspeed would be measured by a pitot tube as a function of dynamic
 *		pressure. Below is a table to compare Q (in bars) to equivalent air
 *		speed (in knots):
 *
 *			Q		 EAS	Q		 EAS	Q		 EAS	Q		 EAS
 *			------------	------------	------------	------------
 *			0.01	  80	0.06	 190	0.20	 350	0.58	 600
 *			0.02	 110	0.08	 220	0.26	 400	0.68	 650
 *			0.03	 140	0.10	 250	0.33	 450	0.79	 700
 *			0.04	 160	0.12	 270	0.41	 500	0.91	 750
 *			0.05	 175	0.15	 300	0.49	 550	1.04	 800
 *
 *	Taking off:
 *
 *		Gentle (like an airliner)			Scramble (like a fighter)
 *
 *		- Trim 2.5%, flaps 2 notches		- Trim neutral, flaps 1 notch
 *		- Throttle to 35%					- Throttle to 70%
 *
 *		For all cases
 *
 *		- Accelerate to 75 m/s
 *		- Bring the nose up *gently* (repeated tap on keyboard is enough)
 *		- Retract gears immediately
 *		- Retract flaps when climb is stable
 *		- Manually adjust trim as you go, or select the fly-by-wire controller
 *
 *	Cruise:
 *
 *		During cruise it is recommended to select the fly-by-wire controller,
 *		as this will relief you from the workload of manual trim management.
 *		Below are some examples of the kind of settings to expect.
 *
 *						speed	alt		(=Q)	throttle	trim
 *
 *			Bonanza		  90	 3.5 k	0.03		 9		  9
 *			Airliner	 250	11.5 k	0.11		15		  1.5
 *			Concorde	 600	18 k	0.24		45		  0
 *			SR-71		1000	24 k	0.25		48		  0.5
 *			X-15		2000	50 k	0.03		 9		 15
 *
 *		The exact settings for throttle and trim depend on the local air den-
 *		sity which varies with temperature. The settings for the last two lines
 *		were determined for prograde/eastwards direction. Other flight direct-
 *		ions will require different settings since the interaction with the
 *		planet rotation is not negligible.
 *		Another curved surface effect is the coriolis force that will induce
 *		a clockwise or anti-clockwise turn resp. on the northern or southern
 *		hemispheres.
 *
 *	Landing:
 *
 *		The goal is to come in on a 5% glide slope, or about 3 degrees.
 *		There is a tick on the pitch ladder at this postition for convenience.
 *		The safe limit to deploy gears should be Q < 0.1, but this is not
 *		checked yet. Below is a table with suggested settings, assuming gears
 *		down and full flaps.
 *
 *			landing
 *			speed		throttle	trim	(= alpha)
 *
 *				55		12.0		21.0	12.9
 *				60		 9.5		15.0	 9.7
 *				65		 9.0		12.0	 7.9
 *				70		 8.5		 8.5	 5.6
 *
 *		The ground effect will help you cushion the impact a bit, but for the
 *		best landings you need to intervene manually to flare out. The vertical
 *		speed at touchdown then determines your rating:
 *
 *			0 .. 2 m/s		excellent
 *			2 .. 4 m/s		normal
 *			4 .. 6 m/s		hard landing
 *			6 and above		crash landing
 *
 *	Gliding with maximum range:
 *
 *		The highest L/D-ratio this aircraft can make is near 8.9 but the
 *      exact value depends Reynolds number, Mach number, etc.
 *		At sea level, the best glide is achieved in the following condition:
 *
 *			required trim setting					5.5%
 *			 = angle of attack (alpha)				4.0°
 *			 = dyn pressure (Q)						0.04 bars
 *			 = speed at sea level					83 m/s
 *
 *      There are 2 gliding challenges located at start points M and U.
 *      Both expect you to reach the waypoint and land without engine power.
 *      Select engine-off mode to start rolling downhill.
 *
 *      Tips for challenge 1 at start point M:
 *      - Trim to 25% initially, turn to 90° while rolling and aim for the 'gap'
 *      - Retract gears as soon as airborne and keep the nose at the horizon
 *      - Pitch down (press down arrow) while rolling to avoid hopping
 *
 *      Tips for challenge 2 at start point U:
 *      - Trim to 15% initially and aim for the 'bump', otherwise same as above
 *      - Turn right to 120° and accelerate to over 90 m/s to clear the obstacles
 *      - Approach the runway with full flaps at 80 m/s
 *
 *	Thrust vectoring:
 *
 *		The thrust vector can be rotated on a ladder of fixed positions from
 *		0 degrees (prograde), via 36, 60, 75, 84, 90 (downward), 105, 120, 144
 *		to 180 degrees (retrograde). This allows VTOL maneuvers, hovering or
 *		flying like a helicopter, and also rapid decelerations.
 *		The control key for thrust vector rotation depends on the browser.
 *
 *			Firefox		'key-next-to-the-left-shift-key'	` or <
 *			Chrome		'key-below-the-esc-key'				~ or °
 *
 *		Pressing this key alone moves the ladder backwards towards 0 degrees,
 *      and together with shift moves the ladder forwards towards 180 degrees.
 *		The throttle for hovering is around 76% (depending on latitude).
 *
 *
 * How to space
 * ------------
 *
 *	Going into orbit:
 *
 *		The safe altitude for a stable orbit in this simulation is 150 km.
 *		Below this altitude (more precisely, when Q > 0.5 µbar) the atmospheric
 *		drag is taken into account and the orbit will slowly decay.
 *		The required orbital speed at 150 km altitude is 2861 m/s.
 *		If timed well, the entire ascent procedure could be done in less than 500s.
 *		For example, when taking off eastward from startpoint B, orbital
 *		insertion can be achieved before crossing over water.
 *
 *		(1) Accelerate upward
 *
 *		At the surface:
 *		- Turn eastwards
 *		- Full throttle
 *		- Maintain a recommended climb angle around 75°
 *
 *		At 30 km altitude:
 *		- If fly-by-wire control was active, return to manual
 *		- Enable RCS with rate control
 *		- Switch info page to orbit info
 *		- Switch HMD to orbit mode
 *		- Keep an eye on the vertical velocity on the HMD
 *
 *		(2) Gravity Turn
 *
 *		Approaching 700 m/s vertical velocity:
 *		- Gently pitch down and follow the the dashed 'hover line'
 *		- Hold vertical velocity approximately constant at 700 m/s
 *		- You can make small corrections by aiming above and below the line
 *		- Keep an eye on the apoapsis ('Ap') value on the orbit info page
 *
 *		(3) Accelerate forward
 *
 *		Approaching 150 km apoapsis ('Ap'):
 *		- Gently pitch down below the horizon and follow the '+Pe' symbol
 *		- Hold apoapsis ('Ap') constant at 150 km
 *		- You can make small corrections by aiming above and below the symbol
 *
 *		From this point onward there are 2 possibilites:
 *
 *		(3a) You reach orbital speed (2861 m/s) before reaching 150 km altitude.
 *		(3b) You reach 150 km altitude before reaching orbital speed.
 *
 * 		Which destiny you are headed can be seen from the theta angle.
 *      If theta is increasing towards 180°, you're on path 3b (good),
 *		otherwise, you're likely on path 3a (not good).
 *
 *      Therefore:
 *		- Keep an eye on the 'theta' value on the orbit info page
 *      - If theta is no longer increasing (3a), reduce throttle until it is.
 *      - If theta crosses 180° (3b), pitch up to hold altitude until insertion.
 *
 *		(4) Orbital insertion:
 *
 *		When 'Pe' and 'Ap' are equal:
 *		- Press space for engine cut off
 *		- Switch RCS to LVLH mode to keep aligned with the orbital rotation
 *		- Congratulations, and enjoy the view!
 *
 *	Unpowered Re-entry from orbit:
 *
 *		This procedure mimics the unpowered re-entry in Space Shuttle style.
 *		It requires a bit less than half an orbit to complete so you will end up
 *      on the opposite side of the planet from where you started out.
 *      It will take about 1700s from de-orbit to touchdown.
 *		Start point A is conveniently located to immediately make the de-orbit
 *      maneuver for a landing at point C.
 *
 *		(1) Prepare de-orbit
 *
 *		- Align with the flight path
 *		- Switch to waypoint info
 *		- Wait until distance to target is about 2500 km
 *
 *		(2) De-orbit
 *
 *		- Switch to orbit info
 *		- Maximum reverse thrust to lower the periapsis down to the surface (0 km)
 *
 *		(3) Prepare re-entry
 *
 *		- Pitch up to 35 degrees
 *		- Activate aero direct manual control
 *		- Trim up to 100%
 *		- Engage spoilers
 *		- Wait until contact with the sensible atmosphere at about 80 km altitude
 *
 *      (4) Re-entry
 *
 *      Re-entry is divided into a temperature phase and a G-force phase.
 *      Throughout both phasees the descent rate is controlled by the bank angle.
 *      In order to not stray off course, you need to reverse left/right bank from
 *      time to time.
 *
 *		(4a) Re-entry phase 1: Temperature control phase
 *
 *		- Switch HMD to surface mode
 *		- Switch to temperature info
 *		- Keep an eye on vertical speed
 *      - When vertical speed approaches -100 m/s roll 80° to the side
 *      ---> Use both roll and yaw controls to make a nice coordinated roll
 *      - Aim for -50 m/s vertical speed
 *      - If temperature raises too quickly, reduce vertical speed even more
 *      - To make it a challenge, try to keep the heating below 65 kW/m²
 *
 *		(4b) Re-entry phase 2: Deceleration control phase
 *
 *      - Below 60 km altitude the peak heating should be over
 *      - Aim for -80 m/s vertical speed
 *		- Keep an eye on the G-load
 *		- When G-load approces 1 g, reduce pitch trim keep it near 1 g
 *      - Continue until the speed approaches Mach 3
 *
 *		(5) Terminal glide
 *
 *		- Level out and trim out
 *		- You should be around Mach 3 at 30 km altitude and close to your target
 *		- Turn off RCS mode
 *      - Switch to waypoint info
 *		- Keep vertical speed at around -80 m/s
 *		- Overfly the target runway
 *		- wait for 'Δh' to read half the value of 'dst' in the waypoint info panel
 *		- Make a turn back to the runway and glide to land
 */

// ----------------------------------------------------------------------------

/*
changes v45:

	Compatibility and compile time
	- fix Edge/Chrome blackout: large arrays of constants replaced by switch functions
	- fix Mac/Safari blackout: workaround 14 against miscompile of textureLodOffset
	- improve compile time: data used in multiple places is always stored in buffers

	Scenery
	- add start point L: "Kilimandjaro" (the old start points shift one letter up)
	- add start points U,V: Hang Gliding 2 challenge
	- add start point W: "The North face"
	- add description of the Hand Gliding challenges in help text

	Performance
	- fix silly recomputation of skylight map for each frame
	- add sphere bounds check before raycast
	- add use of packHalf2x16 intrinsic to replace custom packing (also: workaround 13)
	- add frame rate discretization to help with microstutter

	Render quality
	- improve terrain map seamlessness by changing to piecewise asinh
	- improve shadow quality in mountainous regions (less light leaks)
	- improve spurious shadow leaking in clouds
	- add QUALITY 5 as new ultra setting
	- set QUALITY 4 as new default

	Simulation
	- improve model for aerodynamic heating rate and equilibrium temperature
	- improve model for cp(T) by adding an altitude schedule
	- improve model for drag increase in low Reynolds-number regime
	- improve model for control surface momets (de,da,dr) in high Mach number regime
	- add reference Reynolds number to stability coeffs
	- fix pitching moment in high Mach number regime
	- fix computation of Cladot / Cmadot coeffs
	- update description of flying procedures in help text

	Experience for SCALING_PRESET 6 (1:1 Earth size)
	- apparent size of the sun changes to real size
	- effective nose radius changes to a realistic value for Space Shuttle
	- start location 'A' changes into historic STS-1 orbit parameters

	Userability
	- change of heading and temperature numbers swapped top/bottom on HMD
	- add new info page: temperature
	- add fourth zoom level
	- add F7/F8 local time one hour forward/backward
	- fix shaded background under info page was missing
	- fix debug buffer mode for terrain slope

	Others
	- fix some bugs when TRN_SCALE and SCN_SCALE differ in value
	- fix missing pixels on ocean reflection map in rare occasions
	- minor tweaks of planet data and the coeffs in sincospi()
	- minor tweaks of snow color
	- source cleanup: rename TrnSampler to SphereMap and LocData to ZoneData
	- source cleanup: assorted things into GameStateAux
	- source cleanup: clarify memory map, add bitfield utils, other minor things
	- new ASCII art logo

changes v44:

	- improve coordinate jitter / floating point precision problems close to the ground
		- compensated arithmetic is used in enough places to make experience visually smooth
		- WITH_TRN_HIGHP_RAYCAST was removed as flag because ray intersection is always 'highp' now
	- improve scale invariance
		- cleanup of remaining places ignorant to SCN_SCALE, ATM_SCALE or TRN_SCALE
		- added INV_G_SCALE to separate G-force scale from scene scale
		- added a few example scaling presets in common tab
	- change Ångström exponent of aerosol scattering to a more realistic value
	- add filtered frame time in milliseconds to time info panel
	- minor tweaks (fly-by-wire, visual poisson shot noise, dyngamma params)

changes v43:

	Simulation
	- calculate aerodynamic heating of nose cone and display temperature the HUD
	- add 2nd Air Info page (static air info, dynamic air info)
	- add dynamic viscosity to Atmosphere and Ocean params for calculating local Reynolds numbers
	- improve handling of Knudsen-, Reynolds- and Mach numbers in aerodynamics model

	Others
	- add F10 debug menu
	- source cleanup: refactored the FDM into smaller functions
	- source cleanup: refactored atmosphere and ocean properties into 'FluidEnv'
	- source cleanup: removed unused constants and functions
	- source cleanup: generally moved stuff around in common to have more logical divisions

changes v42:

	- add Naka-Rushton tone mapping model and made it the default
	- fix NaN bug on Mac caused by ground effect calculation
	- fix workaround 04 (vec initializer) for Chrome browser
	- fix formula for sigma in variance-based surface color antialiasing
	- fix every usage of iTimeDelta to use the global filtered dtime instead
	- fix surface lighting for case when light is behind shperical normal
	- fix sun glare interaction with canopy tint color
	- minor tweaks (colors, optical densities, phase functions, ocean reflection, dyngamma)

changes v41:

	- add shot noise simulation in low light levels
	- add color preservation logic to tone mapper
	- add canopy color filter (aids comparison with real world images taken from inside a cockpit)
	- add numpad keys for viewing
	- fix NaN terrain normals when height reaches limit exactly (happens on seafloor)
	- fix shadow contact angle from hardcoded constant to actual apparent sun size
	- minor change of cockpit/HUD

changes v40:

	Flight dynamics model
	- add ground effect
	- add Cnb90, Clb90 coeffs, gives wing rocking effect at high AoA
	- add rarefaction effects based on Knudsen number
	- correct induced drag computation, this changes max L/D ratio, moved gliding challenge accordingly
	- revise fly-by-wire control law to also be somewhat useful underwater

	Refactorings in preparation for multiple celestial bodies
	- remove hardcoded terrain sampler locations
	- move hardcoded terrain colors into data tables
	- move hardcoded cloud parameters into data tables

	Others
	- fix oversteering tendency in input handler for low FPS
	- add TRN_SAFE_SLOPE config
	- minor change to gamut remapping
	- remove 'zoom' text when magnification is active
	- remove KIOSK mode
	- remove IMG_BLACKLEVEL

TODOs:

	multiple celestial bodies
	- change local planet index at sphere-of-influence boundaries
	- check missed ray against other celestial bodies (only sphere impact)
	- render terrains of multiple planets in buffer B
	- update localplanetindex and orbitplanetindex in gamestate at transition distances
	- fix render bug at high planet distances

	performance
	- precompute cloud tau50Z as function of h and n2 (5 ms in 1080p)

	bugs
	- light adaptation is lost after map view
	- marker position is not initialized properly (garbage value)

	atmosphere
	- move AMTL_CORRECTION into data
	- water vapor content dependent on local temperature
	- seasonal variation of cloud patterns
	- decreasing effective molecular mass in thermospheric altitudes?

	ocean
	- ocean color (chlorophyll content) dependent on local temperature (and depth)

	vehicle controls
	- add automatic flaps mode
	- add autothrottle modes
	- add tracking targets to RCS modes
	- add wheel steering (nws) switch on/off

	flight dynamics
	- add ability to do spinning
		* aoa-dependent loss of directional and lateral stability
	- add more mach effects
		* delayed onset of mach drag divergence due to wing sweep
		* mach tuck

	map mode
	- reorganize menus
	- add mode for surface temperature
	- add switches for trajectory and apparent horizon outline

	achievement detector
	- circular orbit detector
	- extreme slow flying detector
	- reverse flying detector
	- hovering in orbit

	info screens
	- de-orbit (entry) guidance assist
	- ascent & orbital insertion assist

	make runtime configrable
	- render options
	- scaling preset
*/

// ----------------------------------------------------------------------------
// IMAGE OPTIONS
// ----------------------------------------------------------------------------

#define WITH_IMG_DIRECT				0					// bypass all image processing

// flags
#define WITH_IMG_BALANCE			1					// enable white balance
#define WITH_IMG_COLPRESERVE		1					// try to preserve colors during tone mapping
#define WITH_IMG_DITHER				1					// enable output dithering
#define WITH_IMG_DYNGAMMA			1					// adapation dependent gamma in response to absolute scene luminance
#define WITH_IMG_EXPOSURE			1					// enable auto exposure
#define WITH_IMG_GLARE				1					// mip-map based glare effect, simulating aperture diffraction
#define WITH_IMG_LENS				1					// mip-map based lens flare effect, simulating internal reflections
#define WITH_IMG_PRIMARIES			1					// enable conversion from monochromatic color primaries to sRGB (or P3)
#define WITH_IMG_RODVISION			1					// simulate scotopic vision at low light levels
#define WITH_IMG_SHOTNOISE			1					// simulate discrete photon counts for low light levels
#define WITH_IMG_SRGB_EOTF			1					// use the exact piecewise sRGB curve, otherwise a simple gamma curve
#define WITH_IMG_SUNGLARE			1					// enable the special-case glare effect centered on the sun
#define WITH_IMG_THRESHOLD			1					// cut off at absolute threshold of vision
#define WITH_IMG_VIGNETTE			1					// enable photographic vignette

// modes
#define WITH_IMG_GAMUT_RESOLVE		1					// handle of gamut colors: 0 = clip, 1 = desaturate, 2 = convex proj,
#define WITH_IMG_SOFT_SATURATE		1					// tone mapping function: 0 = none, 1 = Naka-Rushton, 2 = exp, 3 = tanh, 4 = sin, 5 = atan, 6 = cbrt

// debug
#define WITH_IMG_GAMUTWARN			0					// show out of gamut colors (overrides GAMUTPROJ)

// mac display workaround
#define WITH_IMG_DCI_P3				0					// for MacBook with P3 display when browser does not color manage

const float IMG_BALANCE = .5;							// 0 = absolute colorimetric, 1 = relative colorimetric
const float IMG_COLPRESERVE = .5;						// 0 = no effect, 1 = full effect (restores original color)
const float IMG_GAMMA = 2.2;
const float IMG_GAMMA_VR = 2.4;							// measured for the HTC vive
const float IMG_GLARE_SIZE = .00018;
const float IMG_LENS_STRENGTH = .012;
const float IMG_QUANTIZE = 1. / 255.;
const float IMG_VIGNETTE = 1.;

// Conversion matrices from monochromatic color
// primaries (615, 535, 445) to display color space
// including a white point change from illuminant E to D65
#if WITH_IMG_DCI_P3
const mat3	IMG_PRIMARIES = transpose( mat3(  1.3271, -0.1814,	0.0136,
											  0.0177,  1.0097, -0.0706,
											 -0.0008, -0.0328,	0.9503 ) );


#else // sRGB
const mat3	IMG_PRIMARIES = transpose( mat3(  1.6216, -0.4493,	0.0325,
											 -0.0374,  1.0598, -0.0741,
											 -0.0283, -0.1119,	1.0490 ) );
#endif

const vec3	VIS_DYNGAMMA_PARAMS =	 vec3( .9, .7, .2 );
const vec3	VIS_DYNGAMMA_PARAMS_VR = vec3( 1., .4, .2 );
#if SCALING_PRESET != 6
const float	VIS_EXPONENT =	  -.60;
const float	VIS_EXPONENT_VR = -.30;
const vec3	VIS_LIMITS = vec3( WITH_IMG_RODVISION != 0 ? .001 : .00001, .65e-6, .0008 );
#else
const float	VIS_EXPONENT =	  -.72;
const float	VIS_EXPONENT_VR = -.51;
const vec3	VIS_LIMITS = vec3( WITH_IMG_RODVISION != 0 ? .00005 : .00000007, 1.5e-9, .000037 );
#endif
const vec3	VIS_SCOTOPIC_Y = vec3( .02, .63, .35 ) * 1700. / 683.;
const float VIS_POST_EXPOSURE = 1.;

// ----------------------------------------------------------------------------

GameState GS;
VehicleState VS;
PlanetState PS;
LocalEnv LE;
PlanetData PD;
vec4 DT;
GameStateAux GSX;

float g_subsample = 1.;
float g_subsample_inv = 1.;
float g_pixelscale = 0.;
vec4 g_exposure = vec4(0);
vec3 g_hudcolor = ZERO;
vec3 g_raydir = ZERO;
mat2x3 g_Kr = mat2x3(0);
float g_textlodbias = 0.;
vec2 g_textscale = vec2(1);
vec4 g_overlayframe = vec4(0);
bool g_vrmode = false;
mat3 g_vrframe = mat3(0);
vec4 g_vrfocus = vec4(0);
vec2 g_vrcoord = vec2(0);
vec3 g_vrdir = ZERO;

uniform vec4 unViewport;
uniform vec3 unCorners[5];

vec2 project3d( vec3 r, float z )
{
	return g_vrmode ?
		unViewport.zw * ( g_vrfocus.xy + .5 * z * g_vrfocus.zw * r.yz / r.x * vec2( 1, -1 ) ) :
		iResolution.xy * ( .5 + .5 * z * barrel_distort_inv( CAM_FOCUS * r.yz / r.x, CAM_DISTORT ) * vec2( 1, -iResolution.x / iResolution.y ) );
}

// ----------------------------------------------------------------------------
// HMD PRIMITIVES
// ----------------------------------------------------------------------------

float hmd_chrout_inner( vec2 coord, float size, float chr )
{
	float result = 0.;
	if( coord.x >= 0. && coord.x < size && coord.y >= 0. && coord.y < size )
	{
		vec2 cell = vec2( mod( chr, 16. ), 15. - floor( chr / 16. ) );
		float lod = 5. - log2( size ) + g_textlodbias;
		result += textureLod( iChannel2, cell / 16. + coord * 64. / ( size * iChannelResolution[2].xy ), lod ).x;
	}
	return result;
}

float hmd_chrout( vec2 coord, float size, float chr )
{
	coord.x += TXT_FONT_BACKSLANT * coord.y;
	return hmd_chrout_inner( coord, size, chr );
}

float hmd_txtout( vec2 coord, vec3 cc, int index )
{
	float result = 0.;
	ivec2 addr = ivec2( ( index / 2 ) << 4, int( iResolution.y - 2. ) + ( index & 1 ) );
	vec4 params = IMG_MIPMAP_HIDE * texelFetch( iChannel1, addr, 0 );
	bool underline = params.z < 0.;
	bool vector = params.w < 0.;
	params.zw = abs( params.zw );
	float n = IMG_MIPMAP_HIDE * texelFetch( iChannel1, ivec2( addr.x + 1, addr.y ), 0 ).x;
	bool hudclip = n < 0.;
	n = abs(n);
	if( vector )
	{
		vec3 v = vec3( floor( params.x ), fract( params.x ) * 4096., params.y ) / 2047.5 - 1.;
		if( g_vrmode )
			v *= g_vrframe;
		if( v.x > 0. )
			params.xy = ( project3d( v, GS.camzoom ) - g_overlayframe.xy ) * g_textscale
						- params.w * vec2( n * TXT_FONT_SPACING, 1 ) / 2.;
		else
			n = 0.;
	}
	coord -= params.xy;
	coord.x += TXT_FONT_BACKSLANT * coord.y;
	float i = floor( coord.x / ( params.w * TXT_FONT_SPACING ) );
	float w = params.w * n * TXT_FONT_SPACING;
	if( n != 0. &&
		coord.x >= 0. && coord.x < w && coord.y >= -1. && coord.y < params.w &&
		( !hudclip || ( abs( cc.y ) < HMD_BORDER.x * cc.x && abs( cc.z ) < HMD_BORDER.y * cc.x ) ) )
	{
		float chr = IMG_MIPMAP_HIDE * texelFetch( iChannel1, ivec2( addr.x + ( int( i + 5. ) >> 2 ), addr.y ), 0 )[ int( i + 5. ) & 3 ];
		result += params.z * hmd_chrout_inner( coord - vec2( params.w * ( i * TXT_FONT_SPACING - TXT_FONT_HOFFSET ), 0. ), params.w, chr );
		if( underline )
		{
			float q = min( max( 0., 1. - abs( coord.y + 0. ) ), min( 1. + coord.x, w + 1. - coord.x ) );
			result += params.z * q;
		}
	}
	return result;
}

float hmd_center_dot( vec2 coord )
{
	float result = 0.;
	vec2 p = g_vrmode ? unViewport.zw * g_vrfocus.xy : iResolution.xy / 2.;
	if( coord.x >= p.x - 1. && coord.x < p.x &&
		coord.y >= p.y - 1. && coord.y < p.y )
	{
		result += .7;
	}
	return result;
}

float hmd_symbol_border( inout vec3 v, vec2 limits )
{
	float result = 1.;
	if( v.x < 0. )
		v = UNIT_X + normalize(v);
	v.yz /= v.x;
	v.x = 1.;
	if( abs( v.y ) >= limits.x )
	{
		v.z *= limits.x / abs( v.y );
		v.y = limits.x * sign( v.y );
		result = .5;
	}
	if( abs( v.z ) >= limits.y )
	{
		v.y *= .35 / abs( v.z );
		v.z = .35 * sign( v.z );
		result = .5;
	}
	return result;
}

float hmd_waterline( vec2 coord )
{
	float result = 0.;
	vec3 v = VS.localB[0] * GS.camframe;
	if( g_vrmode )
		v *= g_vrframe;
	if( v.x * abs( v.x ) >= -FRACT_127_128 * dot( v, v ) )
	{
		float sz = hmd_symbol_border( v, HMD_BORDER_SYM );
		mat2 I = mat2( g_textscale.x, 0, 0, g_textscale.y );
		vec2 p = ( coord - project3d( v, GS.camzoom ) ) * g_textscale;
		if( Linfinity( p ) < 10. )
		{
			vec2 a = sz * vec2( -3, -6 );
			vec2 b = sz * vec2( +3, -6 );
			vec2 c = sz * vec2( +6,	 0 );
			vec2 d = sz * vec2( +9,	 0 );
			float shape = 0.;
			shape = max( shape, aaa_line( I, p, a, vec2(0), 1. ) );
			shape = max( shape, aaa_line( I, p, b, vec2(0), 1. ) );
			shape = max( shape, aaa_line( I, p, a, -c, 1. ) );
			shape = max( shape, aaa_line( I, p, b, +c, 1. ) );
			shape = max( shape, aaa_hline( I, p, -d, sz * 3., 1. ) );
			shape = max( shape, aaa_hline( I, p, +c, sz * 3., 1. ) );
			result += shape * sz;
		}
	}
	return result;
}

float hmd_flight_path_marker( vec2 coord )
{
	float result = 0.;
	vec3 v = VS.modes.x == VS_HMD_ORB ?
		VS.orbitv * PS.B * GS.camframe :
		VS.localv * GS.camframe;
	if( g_vrmode )
		v *= g_vrframe;
	if( dot( v, v ) >= .25e-6 && v.x * abs( v.x ) >= -(65535./65536.) * dot( v, v ) )
	{
		float sz = hmd_symbol_border( v, HMD_BORDER_SYM );
		mat2 I = mat2( g_textscale.x, 0, 0, g_textscale.y );
		vec2 p = ( coord - project3d( v, GS.camzoom ) ) * g_textscale;
		vec2 a = vec2( +4, 0 );
		vec2 b = vec2( +9, 0 );
		vec2 c = vec2( 0, +4 );
		float shape = 0.;
		if( Linfinity( p ) < 10. )
		{
			shape = max( shape, aaa_ring( I, p, sz * 8., 1. ) );
			shape = max( shape, aaa_hline( I, p, -sz * b, sz * 5., 1. ) );
			shape = max( shape, aaa_hline( I, p, +sz * a, sz * 5., 1. ) );
			shape = max( shape, aaa_vline( I, p, +sz * c, sz * 4., 1. ) );
		}
		if( v.x < 0. &&
			abs( v.y ) < -HMD_BORDER_SYM.x * v.x &&
			abs( v.z ) < -HMD_BORDER_SYM.y * v.x )
		{
			p = ( coord - project3d( v, GS.camzoom ) ) * g_textscale;
			if( Linfinity( p ) < 10. )
			{
				shape = max( shape, aaa_ring( I, p, 8., 1. ) );
				shape = max( shape, aaa_hline( I, p, -a, 8., 1. ) );
				shape = max( shape, aaa_vline( I, p, -c, 8., 1. ) );
			}
		}
		result += shape * sz;
	}
	return result;
}

float hmd_waypoint( vec2 coord )
{
	float result = 0.;
	vec3 v = ( GS.waypoint - GS.campos ) * GS.camframe;
	if( g_vrmode )
		v *= g_vrframe;
	if( v.x * abs( v.x ) >= -FRACT_127_128 * dot( v, v ) )
	{
		float sz = hmd_symbol_border( v, HMD_BORDER_SYM );
		mat2 I = mat2( g_textscale.x, 0, 0, g_textscale.y );
		vec2 p = ( coord - project3d( v, GS.camzoom ) ) * g_textscale;
		if( Linfinity( p ) < 13. )
		{
			float shape = 0.;
			shape = max( shape, aaa_line( I, p, vec2(0), +sz * vec2( -6, 12 ), 1. ) );
			shape = max( shape, aaa_line( I, p, vec2(0), +sz * vec2( +6, 12 ), 1. ) );
			result += shape * sz;
		}
	}
	return result;
}

float hmd_pitch_ladder( vec2 coord, vec3 cc )
{
	float result = 0.;
	vec3 localv = VS.modes.x == VS_HMD_ORB ?
		VS.orbitv * PS.B :
		VS.localv;
	if( dot( localv, localv ) >= .25e-6 )
	{
		vec3 down = normalize( -VS.localr );
		vec3 horz = normalize( reject( localv, down ) );
		vec3 left = cross( down, horz );
		mat3 M = mat3( horz, left, down );
		vec3 dir = g_raydir * M;
		float Kp = degrees( Linfinity( ( down * dir.x - horz * dir.z ) * g_Kr ) ) / dot( dir.xz, dir.xz );
		float Ks = degrees( Linfinity( left * g_Kr ) ) * inversesqrt( 1. - dir.y * dir.y );

		if( abs( cc.y ) < HMD_BORDER_LAD.x * cc.x && abs( cc.z ) < HMD_BORDER_LAD.y * cc.x )
		{
			// pitch ladder lines
			float pitch = degrees( atan( -dir.z, dir.x ) );
			float side = degrees( atan( dir.y, length( dir.zx ) ) );
			float twist = max( 0., .5 * dir.z );
			float p = pitch + twist * ( abs( side ) - 5. );
			bool tick = mod( abs(p) + 2.5, 10. ) < 5.;
			float shape = 0.;
			if( VS.modes.x == VS_HMD_SFCE )
				shape = aaa_interval( Kp, pitch + 2.8624, Kp / g_textscale.y );
			shape = ( tick ? 1. : .5 ) * max( shape,
				aaa_stipple( Kp, p + 2.5, 5., Kp / ( 5. * g_textscale.y ) ) ) *
				aaa_interval( Ks, abs( side ) - ( tick ? 7.5 : 5.5 ), tick ? 5. : 1. );
			shape = max( shape,
				aaa_interval( Kp, pitch, Kp ) * aaa_interval( Ks, abs( side ) - 45., 80. ) );
			shape = max( shape,
				aaa_stipple( Kp, pitch + 5. + sign( pitch ) * 0.625, 10., .125 ) *
				aaa_interval( Ks, abs( side ) - 7.5 - 2.5 * sign( pitch ), Ks / g_textscale.y ) );
			float bright = .5;
			result += shape * bright;

			// pitch ladder numbers
			const float s15 = sin( radians( 12. ) );
			const float c15 = cos( radians( 12. ) );
			for( float i = -3.; i < 4.; ++i )
			if( i != 0. )
			{
				float a = 30. * i;
				float b = a + 6. * max( 0., .5 * sin( radians(a) ) );
				for( float side = -1.; side < 3.; side += 2. )
				{
					vec2 sc = sincospi( b / 180. );
					vec3 v = M * vec3( sc.y * c15, side * s15, sc.x * c15 ) * GS.camframe;
					if( g_vrmode )
						v *= g_vrframe;
					if( v.x > 0. )
					{
						vec2 p = ( coord - project3d( v, GS.camzoom ) ) * g_textscale;
						result += .5 * hmd_chrout( p + 12. * vec2( TXT_FONT_SPACING, .5 ), 12., 48. + round( abs(a) / 10. ) );
					}
				}
			}

			// neutral-g indicator for orbit HMD
			if( VS.modes.z == VS_ENG_IMP &&
				VS.modes.x == VS_HMD_ORB )
			{
				vec3 r = VS.orbitr;
				float r2 = dot( r, r );
				vec3 gr = r2 < square( PD.radius ) ?
					- PD.GM / cube( PD.radius ) * r :
					- PD.GM / ( r2 * sqrt( r2 ) ) * r;
				vec3 movement_omega = cross( VS.orbitr, VS.orbitv ) / dot( VS.orbitr, VS.orbitr );
				gr -= cross( movement_omega, cross( movement_omega, VS.orbitr ) );

				float a_max = FDM_MASS_SCALE * 136000. / 10630.;
				float a = 0.001 * VS.throttle * a_max;
				vec3 rn = normalize( VS.orbitr );
				float f = sin( radians( VS.tvec ) ) * dot( rn, VS.B[1] );
				float sinpitch = -dot( gr, rn ) / ( a * sqrt( max( 0., 1. - f * f ) ) );
				if( sinpitch < 1. )
				{
					float line1 = degrees( asin( sinpitch ) ) - VS.tvec;
					float line2 = 180. - degrees( asin( sinpitch ) ) - VS.tvec;
					float shape =
						max( aaa_stipple( Kp, pitch + 180. - line1, 360., Kp / ( 360. * g_textscale.y ) ),
							 aaa_stipple( Kp, pitch + 180. - line2, 360., Kp / ( 360. * g_textscale.y ) ) ) *
						aaa_interval( Ks, abs( side ) - 5., 5. ) *
						aaa_stipple( Ks, side, 2., .5 );
					result += .25 * shape;
				}
			}
		}
	}
	return result;
}

void hmd_terrain_radar( inout vec3 col, vec2 coord, vec3 cc )
{
	vec2 uv = ( g_vrmode ? coord + unViewport.xy : coord ) * g_subsample_inv / iResolution.xy;
	if( abs( cc.y ) < HMD_BORDER.x * cc.x && abs( cc.z ) < HMD_BORDER.y * cc.x )
	{
		float center = textureLod( iChannel1, uv, 0. ).w;
		vec4 sides = vec4(
		#if WORKAROUND_14_TEXLODOFFS
			textureLod( iChannel1, uv + vec2( -1,  0 ) / vec2( textureSize( iChannel0, 0 ).xy ), 0. ).w,
			textureLod( iChannel1, uv + vec2( +1,  0 ) / vec2( textureSize( iChannel0, 0 ).xy ), 0. ).w,
			textureLod( iChannel1, uv + vec2(  0, -1 ) / vec2( textureSize( iChannel0, 0 ).xy ), 0. ).w,
			textureLod( iChannel1, uv + vec2(  0, +1 ) / vec2( textureSize( iChannel0, 0 ).xy ), 0. ).w );

		#else
			textureLodOffset( iChannel1, uv, 0., ivec2( -1,	 0 ) ).w,
			textureLodOffset( iChannel1, uv, 0., ivec2( +1,	 0 ) ).w,
			textureLodOffset( iChannel1, uv, 0., ivec2(	 0, -1 ) ).w,
			textureLodOffset( iChannel1, uv, 0., ivec2(	 0, +1 ) ).w );
		#endif
		float mu = dot( sides, vec4(.25) );
		float laplace = ( center - mu ) * GS.camzoom * g_subsample_inv * g_subsample_inv;
		float sigma = dot( ( sides - mu ) * ( sides - mu ), vec4(.25) );
		float range = 2. * sqrt( sigma );
		float shape = .1 / ( .4 + mu * exp2pp( 32. * laplace / ( 0.0003 + range ) ) );
		col += g_hudcolor * shape;
	}
}

void map_position( inout vec3 col, vec2 coord )
{
	float shape = 0.;
	mat2 I = mat2(1);
	vec2 s0 = mc2sc( gs_map_project( GS, VS.localr ) );
	float sr = dot( VS.localB[0], normalize( VS.localr ) );

	if( abs( sr ) < .9995 )
	{
		// arrow if heading is defined
		vec2 s1 = mc2sc( gs_map_project( GS, VS.localr + VS.localB[0] ) );
		vec2 ds = normalize( s1 - s0 );
		mat2 M = mat2( ds, perp( ds ) );
		vec2 a = s0 + M * vec2( +6, 0 );
		vec2 b = s0 + M * vec2( -6, -4 );
		vec2 c = s0 + M * vec2( -6, +4 );
		shape = max( shape, aaa_line( I, coord, a, b, 1. ) );
		shape = max( shape, aaa_line( I, coord, b, c, 1. ) );
		shape = max( shape, aaa_line( I, coord, c, a, 1. ) );
	}
	else
	if( sr < 0. )
		// cross if downwards
		shape = max( aaa_line( I, coord, s0 - 5., s0 + 5., 1. ),
					 aaa_line( I, coord, s0 + vec2( +5, -5 ), s0 + vec2( -5, +5 ), 1. ) );
	else
		// ring if upwards
		shape = aaa_ring( I, coord - s0, 10., 1. );

	float phase = .25 + .75 * step( .5, fract( iTime ) );
	col += vec3( 1, .5, .0 ) * shape * phase;
}

void map_marker( inout vec3 col, vec2 coord )
{
	mat2 I = mat2(1);
	float shape = 0.;
	vec2 s = mc2sc( gs_map_project( GS, GS.mapmarker ) );
	shape = max( shape, aaa_hline( I, coord, s - vec2( 6, 0 ), 12., 1. ) );
	shape = max( shape, aaa_vline( I, coord, s - vec2( 0, 6 ), 12., 1. ) );
	col += vec3( 1, .5, .0 ) * shape;
}

void map_waypoint( inout vec3 col, vec2 coord )
{
	mat2 I = mat2(1);
	float shape = 0.;
	vec2 s = mc2sc( gs_map_project( GS, GS.waypoint ) );
	shape = max( shape, aaa_line( I, coord, s, s + vec2( -6, 12 ), 1. ) );
	shape = max( shape, aaa_line( I, coord, s, s + vec2( +6, 12 ), 1. ) );
	col += vec3( 1, .5, .0 ) * shape;
}

void map_orbit_track( inout vec3 col, vec2 sc )
{
	vec3 dpdx = ZERO, dpdy = ZERO;
	vec4 p = gs_map_unproject_d( GS, sc, iResolution.xy, dpdx, dpdy );
	vec4 px = vec4( dpdx.x, dpdy.x, 0, p.x );
	vec4 py = vec4( dpdx.y, dpdy.y, 0, p.y );
	vec4 pz = vec4( dpdx.z, dpdy.z, 0, p.z );
	vec4 plng = atan2_d( py, px );

	vec3 r = VS.localr;
	vec3 v = VS.orbitv * PS.B; // not: localv!
	Kepler K = Kepler( 0., 0., 0., 0., 0. );
	float nu = kp_init( K, r, v, PD.GM );
	float M = kp_E2M( kp_nu2E( nu, K.e ), K.e );
	vec3 h = cross( r, v );
	float invsin_i = length(h) / length( h.xy );
	float invtan_i = h.z / length( h.xy );
	if( K.e < .00005 )
	{
		K.w = asin( clamp( normalize(r).z * invsin_i, -1., 1. ) );
		if( v.z < 0. )
			K.w = PI - K.w;
	}

	vec4 dlng = asin2_d( pz * invtan_i, hypot_d( px, py ) );
	vec4 dnu = asin2_d( pz * invsin_i, ONE_D );
	float dMdt = sqrt( PD.GM * cube( abs( 1. - K.e * K.e ) / K.p ) );
	float dphidM = PS.omega / dMdt;
	mat2x4 ll = mat2x4( const_d( K.O ) + dlng, const_d( K.O ) - dlng - const_d(PI) );
	mat2x4 nn = mat2x4( const_d( -K.w ) + dnu, const_d( -K.w ) - dnu - const_d(PI) );
	mat2x4 MM = mat2x4( kp_E2M_d( kp_nu2E_d( nn[0], K.e ), K.e ), kp_E2M_d( kp_nu2E_d( nn[1], K.e ), K.e ) );
	mat2x4 aa = MM - mat2x4( const_d(M), const_d(M) );
	vec2 KK = vec2( length( ll[0].xy - plng.xy - aa[0].xy * dphidM ), length( ll[1].xy - plng.xy - aa[1].xy * dphidM ) );
	vec2 JJ = vec2( length( aa[0].xy ), length( aa[1].xy ) );

	vec3[3] colors = vec3[3](
		vec3( 1, .5, 0 ),
		vec3( .4, .4, .4 ),
		vec3( .1, .1, .1 ) );

	float stipple = 15. * dMdt;
	float mask = aaa_interval( dFdy(p.w), p.w, 2. );
	float revlimit = 3. * TAU;

#define w2vec2( _a ) vec2( _a[0].w, _a[1].w )

	if( mask >= FRACT_1_64 )
	for( int i = 0; i < ( K.e < .99995 ? 3 : 1 ); ++i )
	{
		float shape = 0.;
		float k = float(i) * TAU;
		vec2 d = ( K.e < .99995 ? ( mod( w2vec2( aa ), TAU ) + k ) : w2vec2( aa ) ) * dphidM;
		vec2 u = mod( w2vec2( ll ) - plng.w - d + PI, TAU ) - PI;
		vec2 s = aaa_interval2( KK, u, KK ) *
			aaa_stipple2( JJ, w2vec2( aa ), vec2( stipple ), vec2(.5) ) *
			aaa_step2( JJ, revlimit - d ) *
			( K.e < 1. ? vec2(1.) : aaa_step2( KK, w2vec2( aa ) ) );
		col += mask * hmax(s) * colors[ min( i, 3 ) ];
	}

#undef w2vec2
}

// ----------------------------------------------------------------------------
// POST PROCESSING
// ----------------------------------------------------------------------------

vec3 lens_lookup( vec2 uv, float k, float lod )
{
	uv = .5 * g_subsample_inv + k * ( .5 * g_subsample_inv - uv );
	return textureLod( iChannel1, uv, lod ).xyz *
		16. * saturate( uv.x * g_subsample ) * saturate( uv.y * g_subsample ) *
			  saturate( 1. - uv.x * g_subsample ) * saturate( 1. - uv.y * g_subsample );
}

vec3 post_get_image( vec2 uv )
{
	float k = min( 2.3, sqrt( sqrt( g_pixelscale ) / IMG_GLARE_SIZE ) );
	float sharpen = .182;

	uv *= g_subsample_inv;
	if( g_vrmode && uv.x >= .5 * g_subsample_inv )
		uv.x += .5 - .5 * g_subsample_inv;

	vec3 col = ZERO;
#if WITH_IMG_GLARE && !WITH_IMG_DIRECT
	if( bit_is_unset( GS.switches, GS_SW_TRMAP ) )
	{
		vec3 wsum = ZERO;
		for( float i = 0.; i < 10.; ++i )
		{
			vec3 img = textureLod( iChannel1, uv, i ).xyz;
			float w = 1. / ( 1. + exp2( k * i ) );
			if( i == 1. )
				w -= sharpen;
			col += w * img;
			wsum += w;
		}
		col = clamp( col / wsum, 0., 16. );
	}
	else
#endif
		col = textureLod( iChannel1, uv, 0. ).xyz;

#if WITH_IMG_LENS && !WITH_IMG_DIRECT
	if( bit_is_unset( GS.switches, GS_SW_TRMAP ) )
	{
		float bias = .5 * log2( g_pixelscale );
		col += .25 * IMG_LENS_STRENGTH * lens_lookup( uv,-.5, -5. - bias );
		col += .25 * IMG_LENS_STRENGTH * lens_lookup( uv, .5, -4. - bias );
		col += .25 * IMG_LENS_STRENGTH * lens_lookup( uv, 1., -5.5 - bias );
		col += .25 * IMG_LENS_STRENGTH * lens_lookup( uv, 2., -7. - bias );
	}
#endif

	return col;
}

float chebychev6( float x )
	{ float x2 = x * x; return ( ( 32. * x2 - 48. ) * x2 + 18. ) * x2 - 1.; }

void post_sun_glare( inout vec3 col, vec3 raydir, float v )
{
	if( bit_is_set( GS.dbg_switches, GS_DBG_BDISP_MASK ) )
		return;

#if WITH_IMG_SUNGLARE
	vec3 sunshadow = IMG_MIPMAP_HIDE * texelFetch( iChannel1, ivec2( ADDR_D_SUN_VISIBILITY, 0 ), 0 ).xyz;
	mat3 frame = GS.camframe;
	if( g_vrmode )
		frame *= g_vrframe;
	float b = 1. - square( .81 / GS.camzoom );
	float c = 1. - square( .71 / GS.camzoom );
	float d = dot( normalize( reject( cross( LE.L, raydir ), frame[0] ) ),
				   normalize( reject( cross( LE.L, frame[2] ), frame[0] ) ) );
	float cosbeta = sqrt( max( 0., 1. - LE.sundisk ) );
	float shape = 1. / ( 1. + 0.985 * chebychev6(d) );
	float offimage = parabolstep( b, c, dot( frame[0], LE.L ) );
	float e = exp2( -24. * sqrt( max( 0., 1. - square( dot( raydir, LE.L ) ) ) ) );
	vec3 tmp = offimage * LE.sunlight * e * sunshadow * ( 1. - cosbeta ) * shape /
		max( vec3( ( 1. - cosbeta ) * shape / IMG_EXPOSURE_MAX ), cosbeta - dot( raydir, LE.L ) );
	if( v >= 1. - VS.canopy )
		tmp *= irselect( COL_CANOPY_TINT, bit_is_set( GS.switches, GS_SW_IRCAM ) );
	col += tmp;
#endif
}

void console_throttle_graphics( inout vec3 col, vec2 coord )
{
	mat2 I = mat2(1);
	float t = VS.throttle;
	vec2 size = vec2( 15, 60. * abs(t) );
	if( Linfinity( coord ) < 61. )
	{
		float shape = aaa_rect( I, coord - size / 2., size, vec2(1) );
		if( t >= 0. )
			shape = max( shape, aaa_box( I, coord - size / 2., size, vec2(1) ) * .25 );
		col += g_hudcolor * shape;
	}
}

void post_console_overlay( inout vec3 col, vec2 coord )
{
	vec2 uv = mix( vec2( iResolution.x, 0 ), coord, g_textscale ) / iResolution.xy;
	coord = ( coord - g_overlayframe.xy ) * g_textscale;
	if( !g_vrmode )
	{
		float consolemask = uv.y * iResolution.y - 24.;
		if( bit_is_set( GS.switches, GS_SW_IPAGE_MASK ) )
		{
			vec2 b = ( uv.xy * iResolution.xy - vec2( iResolution.x - 136., 80 ) ) * vec2( -1, 1 );
			float c = max( b.x + b.y, hmax( b ) );
			consolemask = clamp( consolemask, 0., 16. ) + clamp( c, 0., 16. ) - 16.;
		}
		col *= mix( .5, 1., saturate( consolemask / 16. ) );
	}
	console_throttle_graphics( col, coord - vec2( 16, 12 ) );
}

void post_hmd_overlay( inout vec3 col, vec2 coord, vec3 cc )
{
	col += g_hudcolor * hmd_center_dot( coord );
	col += g_hudcolor * hmd_waterline( coord );
	col += g_hudcolor * hmd_flight_path_marker( coord );
	col += g_hudcolor * hmd_pitch_ladder( coord, cc );
	if( dot( GS.waypoint, GS.waypoint ) > 0. )
		col += g_hudcolor * hmd_waypoint( coord );
}

void post_map_overlay( inout vec3 col, vec2 coord )
{
	coord = ( coord - g_overlayframe.xy ) * iResolution.xy / g_overlayframe.zw;
	map_position( col, coord );
	if( dot( GS.mapmarker, GS.mapmarker ) > 0. )
		map_marker( col, coord );
	if( dot( GS.waypoint, GS.waypoint ) > 0. )
		map_waypoint( col, coord );
	if( bit_is_unset( GSX.stateflags, GSX_SF_LOCALPHYSICS ) )
		map_orbit_track( col, coord );
}

void post_text_overlay( inout vec3 col, vec2 coord, vec3 cc )
{
	coord = ( coord - g_overlayframe.xy ) * g_textscale;
#if WORKAROUND_10_NOUNROLL
	for( int i = 0; i < NOUNROLL( TXT_FMT_MAX_COUNT ); ++i )
#else
	for( int i = 0; i < TXT_FMT_MAX_COUNT; ++i )
#endif
		col += g_hudcolor * hmd_txtout( coord, cc, i );
}

void post_overlay( inout vec3 col, vec2 coord, vec3 cc )
{
	bool mapmode = bit_is_set( GS.switches, GS_SW_TRMAP );
	if( GS.stage == GS_STAGE_RUNNING )
	{
		if( !mapmode )
		{
			if( bit_is_set( GS.switches, GS_SW_TRDAR ) )
				hmd_terrain_radar( col, coord, cc );
			if( VS.modes.x > 0 )
				post_hmd_overlay( col, coord, cc );
			post_console_overlay( col, coord );
		}
		else
			post_map_overlay( col, coord );
	}
	post_text_overlay( col, coord, cc );
}

void post_vignette( inout vec3 col, vec3 cc )
{
#if WITH_IMG_VIGNETTE
	col *= pow( cc.x, IMG_VIGNETTE );
#endif
}

vec2 irwin_hall_noise_2D( uvec2 coord, uint seed, int N )
{
	uvec2 rand = uvec2( 131071u * coord.x + 31u * coord.y, 127u * coord.x + 8191u * coord.y );
	rand = rand * 524187u + seed * 7u;
	rand = rand * 2147483647u + seed * 3u;
	vec2 result = vec2(0.);
	for( int i = 0; i < N; ++i )
		{ rand = rand * rand | 1u; result.xy += vec2( rand ); }
	float n = float(N);
	float s = sqrt( 12. / n );
	return s * ( result * 2.32830644e-10 - n / 2. );
}

vec4 irwin_hall_noise_4D( uvec2 coord, uint seed, int N )
	{ return vec4( irwin_hall_noise_2D( coord, 2u * seed, N ), irwin_hall_noise_2D( coord, 2u * seed + 1u, N ) ); }

vec4 poisson_4d( vec4 lambda, vec4 noise )
{
	const float magic = .395078569;
	vec4 urnd = vec4( floatBitsToUint( noise ) * RNG32 ) * 2.32830644e-10;
	vec4 p0 = exp( -lambda );
	return mix(
		step( p0, urnd ) + step( p0 * ( 1. + lambda ), urnd ),
		floor( max( vec4(0), magic + lambda + sqrt( lambda ) * noise ) ),
		step( .25, lambda ) );
}

void post_exposure( inout vec3 col, vec2 fcoord )
{
#if WITH_IMG_SHOTNOISE
	vec4 k = COL_THRESHOLD * COL_THRESHOLD_AREA * COL_THRESHOLD_TIME / ( g_pixelscale * DT.z );
	vec4 noise = irwin_hall_noise_4D( uvec2( fcoord ), uint( iFrame ), 4 );
#endif
#if WITH_IMG_EXPOSURE
  #if WITH_IMG_RODVISION
	float y = dot( col, VIS_SCOTOPIC_Y );
	float rod = y * VIS_LIMITS.z / ( y + VIS_LIMITS.z );
   #if WITH_IMG_SHOTNOISE
	vec4 result = k * poisson_4d( vec4( col, rod ) / k, noise );
	col = result.xyz;
	rod = result.w;
   #endif
	col = g_exposure.z * col + .25 * COL_RODVISION * g_exposure.w * rod;
  #else
   #if WITH_IMG_SHOTNOISE
	col = k.xyz * poisson_4d( vec4( col, 0 ) / k, noise ).xyz;
   #endif
	col = g_exposure.z * col;
  #endif
#endif
}

vec3 saturate_func( vec3 col )
{
#if WITH_IMG_SOFT_SATURATE == 1
	return col * inversesqrt( col * col + .96 );
#elif WITH_IMG_SOFT_SATURATE == 2
	return 1. - exp( -1.116 * col );
#elif WITH_IMG_SOFT_SATURATE == 3
	return tanh( 1.014 * col );
#elif WITH_IMG_SOFT_SATURATE == 4
	return sin( min( 1.007 * col, PI / 2. ) );
#elif WITH_IMG_SOFT_SATURATE == 5
	return atan( 1.034 * col * PI / 2. ) * ( 2. / PI );
#elif WITH_IMG_SOFT_SATURATE == 6
	return col / pow( col * col * col + .992, vec3( .33333333 ) );
#elif WITH_IMG_SOFT_SATURATE == 7
	return col / pow( col * col * col * col + .9984, vec3( .25 ) );
#else
	return saturate( col );
#endif
}

void post_saturate( inout vec3 col )
{
	vec3 orig = col;
	col = saturate_func( col );
#if WITH_IMG_COLPRESERVE
	orig = saturate_func( orig * max( FRACT_1_4096, 1. - IMG_COLPRESERVE ) );
	col = orig * hmax( col ) / hmax( orig );
#endif
}

vec3 nnlsproj( const mat3 A, const vec3 x, const vec3 b )
{
	mat3x3 At = transpose(A);
	vec3 invcolsq = 1. / vec3( lensq( At[0] ), lensq( At[1] ), lensq( At[2] ) );
	vec3 lambda = ZERO;
	vec3 tau = ZERO;
	for( int k = 0; k < 5; ++k )
	{
		for( int i = 0; i < 3; ++i )
		{
			float dist = dot( At[i], tau ) + x[i];
			float theta = max( -lambda[i], -dist * invcolsq[i] );
			lambda[i] += theta;
			tau += theta * At[i];
		}
	}
	return x + A * tau;
}

void post_primaries( inout vec3 col )
{
#if WITH_IMG_PRIMARIES
  #if WITH_IMG_BALANCE
	vec3 balance = pow( COL_D65 / COL_SUNLIGHT.xyz, vec3( IMG_BALANCE ) );
  #else
	 vec3 balance = ONE;
  #endif
	vec3 tmp = IMG_PRIMARIES * ( col * balance ) / hmax( IMG_PRIMARIES * balance );
  #if WITH_IMG_GAMUTWARN
	if( hmin( tmp ) < 0. )
		tmp = vec3(1,0,1) * dot( tmp, vec3( .2, .7, .1 ) );
  #elif WITH_IMG_GAMUT_RESOLVE == 1
	tmp = mix( ONE * dot( col, COL_YWEIGHTS ), tmp, 1. / ( 1. + max( 0., hmax( -tmp ) ) ) );
  #elif WITH_IMG_GAMUT_RESOLVE == 2
	tmp = nnlsproj( IMG_PRIMARIES, tmp, col );
  #endif
	col = max( ZERO, tmp );
#endif
}

void post_dyngamma( inout vec3 col )
{
#if WITH_IMG_DYNGAMMA
	vec3 params = g_vrmode ? VIS_DYNGAMMA_PARAMS_VR : VIS_DYNGAMMA_PARAMS;
	float gamma = params.x + params.y * pow( g_exposure.y, params.z );
	float a = 0.0625;
	float b = .5;
	col = b * ( pow( col + a, vec3(gamma) ) - pow( a, gamma ) ) / ( pow( b + a, gamma ) - pow( a, gamma ) );
#endif
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

vec3 eotf( vec3 arg )
{
	return g_vrmode ?
		pow( arg, vec3( IMG_GAMMA_VR ) ) :
#if WITH_IMG_SRGB_EOTF
		mix( arg / 12.92, pow( ( arg + .055 ) / 1.055, vec3( 2.4 ) ), lessThan( vec3( .04045 ), arg ) );
#else
		pow( arg, vec3( IMG_GAMMA ) );
#endif
}

vec3 oetf( vec3 arg )
{
	return g_vrmode ?
		pow( arg, vec3( 1. / IMG_GAMMA_VR ) ) :
#if WITH_IMG_SRGB_EOTF
		mix( 12.92 * arg, 1.055 * pow( arg, vec3( .416667 ) ) - .055, lessThan( vec3( .0031308 ), arg ) );
#else
		pow( arg, vec3( 1. / IMG_GAMMA ) );
#endif
}

vec3 quantize_and_dither( vec3 col, float quant, vec2 fcoord )
{
	vec3 noise = .5/65536. +
				 texelFetch( iChannel3, ivec2( fcoord / 8. ) & ( int( iChannelResolution[3] ) - 1 ), 0 ).xyz * 255./65536. +
				 texelFetch( iChannel3, ivec2( fcoord )		 & ( int( iChannelResolution[3] ) - 1 ), 0 ).xyz * 255./256.;
#if WITH_IMG_DITHER
	vec3 c0 = floor( oetf( col ) / quant ) * quant;
	vec3 c1 = c0 + quant;
	vec3 discr = mix( eotf( c0 ), eotf( c1 ), noise );
	return mix( c0, c1, lessThan( discr, col ) );
#else
	return oetf( col );
#endif
}

void main_image_worker( out vec4 fcolor, in vec2 fcoord )
{
	fcolor = vec4( ZERO, 1 );

#if BUFFER_RUNLEVEL >= 5

	if( iFrame == 0 )
		return;

	GS = gs_load( iChannel0, ADDR_GAME_STATE );
	PD = pd_load( iChannel0, pd_addr(1) );
	DT = memload( iChannel0, ADDR_DTIME, 1 );
	GSX = gsx_load( iChannel0, ADDR_GAME_STATE_AUX );

	bool mapmode = bit_is_set( GS.switches, GS_SW_TRMAP );
	g_subsample = mapmode ? 1. : gs_get_subsample( GS );
	g_subsample_inv = safediv( 1., g_subsample );

	if( fcoord.y >= 2. * g_subsample_inv && fcoord.y < iResolution.y - 2. * g_subsample_inv )
	{
		VS = vs_load( iChannel0, ADDR_VEHICLE_STATE );
		PS = ps_load( iChannel0, ps_addr(1) );
		LE = le_load( iChannel0, ADDR_LOCAL_ENV );
		g_exposure.xy = GS.exposure;
		g_exposure.zw = pow( GS.exposure + VIS_LIMITS.xy, vec2( g_vrmode ? VIS_EXPONENT_VR : VIS_EXPONENT ) );
		g_hudcolor = ( mapmode ? 1. : GS.hudbright ) * COL_P43PHOSPHOR;
		if( !mapmode && g_vrmode )
			g_hudcolor /= GS.camzoom;

		vec2 uv = fcoord / iResolution.xy;
		vec2 sc = 2. * uv - 1.;
		vec2 ec = sc * vec2( 1, iResolution.y / iResolution.x );
		vec3 cc = ZERO;
		if( g_vrmode )
		{
			cc = g_vrdir * g_vrframe;
			if( !mapmode && dot( cc.yz, cc.yz ) >= 1.5 / GS.camzoom * cc.x * cc.x )
				return;
			cc.yz /= GS.camzoom;
			cc = normalize( cc );
			g_raydir = GS.camframe * g_vrframe * cc;
		}
		else
		{
			cc = normalize( vec3( CAM_FOCUS, barrel_distort( vec2( ec.x, -ec.y ) / GS.camzoom, CAM_DISTORT ) ) );
			g_raydir = GS.camframe * cc;
		}
		g_pixelscale = .25 * abs( cc.x * dFdx( cc.y / cc.x ) * dFdy( cc.z / cc.x ) );
		g_Kr = mat2x3( dFdx( g_raydir ), dFdy( g_raydir ) );

		vec3 col = bit_is_set( GS.dbg_switches, GS_DBG_BDISP_MASK ) ?
			textureLod( iChannel1, uv, 0. ).xyz :
			post_get_image( uv );

	#if WITH_IMG_DIRECT
		fcolor.xyz = VIS_POST_EXPOSURE * col;
		return;
	#endif

		//*
		if( bit_is_unset( GS.switches, GS_SW_CHEES ) )
		{
			g_overlayframe = vec4( 0, 0, iResolution.xy );
			if( g_vrmode )
			{
				float z = mapmode ? 1. : GS.camzoom;
				g_overlayframe.xy = project3d( vec3( 1.35, -1, +iResolution.y / iResolution.x ), z );
				g_overlayframe.zw = project3d( vec3( 1.35, +1, -iResolution.y / iResolution.x ), z ) - g_overlayframe.xy;
			}
			g_textscale = texelFetch( iChannel1, ivec2( ADDR_D_TEXTSCALE, 0 ), 0 ).xy * IMG_MIPMAP_HIDE / g_overlayframe.zw;
			g_textlodbias = log2( max( g_textscale.x, g_textscale.y ) );
			post_overlay( col, g_vrmode ? fcoord - unViewport.xy : fcoord, cc );
		}

		if( !mapmode )
		{
			post_sun_glare( col, g_raydir, uv.y );
			post_vignette( col, cc );
			post_exposure( col, fcoord );
			post_dyngamma( col );
			col *= VIS_POST_EXPOSURE;
		}

		uint dgraph = bitfield_get_uint( GS.dbg_switches, GS_DBG_DGRAPH_MASK, GS_DBG_DGRAPH_SHIFT );
		vec2 pq = fcoord / iResolution.xy * 2.25 - 1.125;
		if( dgraph != 0u && all( lessThan( abs( pq ), vec2(1) ) ) )
		{
			col *= .25;
			vec4 f = texelFetch( iChannel0, ivec2( fcoord.x, iResolution.y - 2. ), 0 );
			vec4 K = sqrt( 1. + .3333 * square( dFdx( f ) / dFdx( pq.x ) ) ) * dFdy( pq.y );
			col = mix( col, vec3(1), aaa_interval( dFdx( pq.x ), 0. - pq.x, .25 * dFdx( pq.x ) ) );
			col = mix( col, vec3(1), aaa_interval( dFdy( pq.y ), 0. - pq.y, .25 * dFdy( pq.y ) ) );
			col = mix( col, vec3(1), aaa_stipple( dFdx( pq.x ), 0.05555 - pq.x, .1111, .140625 * dFdx( pq.x ) ) );
			col = mix( col, vec3(1), aaa_stipple( dFdy( pq.y ), 0.08333 - pq.y, .1667, .1875 * dFdy( pq.y ) ) );
			col = mix( col, vec3(1), aaa_stipple( dFdx( pq.x ), 0.16667 - pq.x, .3333, .1875 * dFdx( pq.x ) ) );
			col = mix( col, vec3(1), aaa_stipple( dFdy( pq.y ), 0.16667 - pq.y, .3333, .1875 * dFdy( pq.y ) ) );
			col = mix( col, vec3( .3, 1., .1 ), aaa_interval( dFdx( pq.x ), f.w - pq.x, .25 * dFdx( pq.x ) ) );
			col = mix( col, vec3( 1., .5, .1 ), aaa_interval( K.x, f.x - pq.y, K.x ) );
			col = mix( col, vec3( .1, .3, 1. ), aaa_interval( K.y, f.y - pq.y, K.y ) );
			col = mix( col, vec3( 1., .1, .1 ), aaa_interval( K.z, f.z - pq.y, K.z ) );
		}

		post_saturate( col );
		post_primaries( col );
		//*/

		fcolor.xyz = quantize_and_dither( col, IMG_QUANTIZE, fcoord );
	}
#endif // RUNLEVEL
}

void mainImage( out vec4 fcolor, in vec2 fcoord )
	{ main_image_worker( fcolor, fcoord ); }

void mainVR( out vec4 fcolor, in vec2 fcoord, in vec3 _ro_dummy_, in vec3 _rd_dummy_ )
{
	g_vrmode = true;
	vec3 horz = ( unCorners[1] + unCorners[2] - unCorners[0] - unCorners[3] ).zxy * vec3( -1, 1, -1 );
	vec3 down = ( unCorners[0] + unCorners[1] - unCorners[2] - unCorners[3] ).zxy * vec3( -1, 1, -1 );
	vec3 forw = ( unCorners[0] + unCorners[1] + unCorners[2] + unCorners[3] - 4. * unCorners[4] ).zxy * vec3( -1, 1, -1 );
	g_vrframe[1] = normalize( horz );
	g_vrframe[2] = normalize( down );
	g_vrframe[0] = cross( g_vrframe[1], g_vrframe[2] );
	vec3 cent = g_vrframe[0] * dot( forw, g_vrframe[0] ) - 2. * ( unCorners[0] - unCorners[4] ).zxy * vec3( -1, 1, -1 );
	g_vrfocus.xy = vec2( dot( cent, g_vrframe[1] ) / dot( horz, g_vrframe[1] ), dot( cent, g_vrframe[2] ) / dot( -down, g_vrframe[2] ) );
	g_vrfocus.zw = dot( forw, g_vrframe[0] ) / vec2( dot( horz, g_vrframe[1] ), dot( down, g_vrframe[2] ) );
	g_vrcoord = ( gl_FragCoord.xy - unViewport.xy ) / unViewport.zw;
	g_vrdir = normalize( mix( mix( unCorners[0], unCorners[1], g_vrcoord.x ),
							  mix( unCorners[3], unCorners[2], g_vrcoord.x ), g_vrcoord.y ) - unCorners[4] ).zxy * vec3( -1, 1, -1 );
	main_image_worker( fcolor, gl_FragCoord.xy );
}

#define unViewport _unViewport_dummy_
#define unCorners _unCorners_dummy_
