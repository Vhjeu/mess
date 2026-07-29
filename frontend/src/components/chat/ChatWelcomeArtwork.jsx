const ChatWelcomeArtwork = () => (
    <div className="chat-welcome-artwork" aria-hidden="true">
        <svg viewBox="0 0 320 260" role="presentation" focusable="false">
            <defs>
                <linearGradient id="welcome-primary" x1="52" y1="48" x2="230" y2="207" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#a69bff" />
                    <stop offset="0.48" stopColor="#7667f5" />
                    <stop offset="1" stopColor="#5140c9" />
                </linearGradient>
                <linearGradient id="welcome-secondary" x1="132" y1="75" x2="270" y2="199" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#6ee7ff" />
                    <stop offset="0.42" stopColor="#7e9cff" />
                    <stop offset="1" stopColor="#8a5cf6" />
                </linearGradient>
                <linearGradient id="welcome-bridge" x1="101" y1="125" x2="224" y2="125" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#d7d1ff" stopOpacity="0.25" />
                    <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="1" stopColor="#bdefff" stopOpacity="0.28" />
                </linearGradient>
                <radialGradient id="welcome-halo">
                    <stop stopColor="#7968f2" stopOpacity="0.3" />
                    <stop offset="0.56" stopColor="#7968f2" stopOpacity="0.09" />
                    <stop offset="1" stopColor="#7968f2" stopOpacity="0" />
                </radialGradient>
                <filter id="welcome-shadow" x="-35%" y="-35%" width="170%" height="180%">
                    <feDropShadow dx="0" dy="15" stdDeviation="13" floodColor="#302571" floodOpacity="0.32" />
                </filter>
                <filter id="welcome-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            <ellipse className="chat-welcome-artwork__halo" cx="160" cy="132" rx="142" ry="116" fill="url(#welcome-halo)" />

            <g className="chat-welcome-artwork__orbit">
                <ellipse cx="160" cy="130" rx="132" ry="86" pathLength="1" />
                <circle className="chat-welcome-artwork__orb chat-welcome-artwork__orb--one" cx="38" cy="99" r="4.5" />
                <circle className="chat-welcome-artwork__orb chat-welcome-artwork__orb--two" cx="277" cy="166" r="3.5" />
            </g>

            <g className="chat-welcome-artwork__back-card">
                <path
                    d="M74 88C74 70.327 88.327 56 106 56H179C196.673 56 211 70.327 211 88V129C211 146.673 196.673 161 179 161H128L100 181L105 160.984C87.715 160.45 74 146.403 74 129V88Z"
                    fill="url(#welcome-primary)"
                    filter="url(#welcome-shadow)"
                />
                <path
                    d="M92 88C92 79.716 98.716 73 107 73H177"
                    fill="none"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeOpacity="0.28"
                    strokeWidth="3"
                />
                <circle cx="112" cy="111" r="6" fill="#ffffff" fillOpacity="0.96" />
                <circle cx="141" cy="111" r="6" fill="#ffffff" fillOpacity="0.78" />
                <circle cx="170" cy="111" r="6" fill="#ffffff" fillOpacity="0.58" />
            </g>

            <g className="chat-welcome-artwork__front-card">
                <path
                    d="M137 124C137 106.327 151.327 92 169 92H228C245.673 92 260 106.327 260 124V163C260 180.673 245.673 195 228 195H211L236 215L197 195H169C151.327 195 137 180.673 137 163V124Z"
                    fill="url(#welcome-secondary)"
                    filter="url(#welcome-shadow)"
                />
                <path
                    d="M159 157C171 143 181 169 194 151C207 133 217 157 238 131"
                    fill="none"
                    stroke="url(#welcome-bridge)"
                    strokeLinecap="round"
                    strokeWidth="5"
                />
                <circle className="chat-welcome-artwork__signal" cx="159" cy="157" r="4" fill="#ffffff" />
                <circle className="chat-welcome-artwork__signal chat-welcome-artwork__signal--late" cx="238" cy="131" r="4" fill="#ffffff" />
            </g>

            <g className="chat-welcome-artwork__connector" filter="url(#welcome-glow)">
                <path
                    d="M117 187C134 215 178 225 206 207"
                    fill="none"
                    pathLength="1"
                    stroke="#a99dff"
                    strokeLinecap="round"
                    strokeWidth="2"
                />
                <circle cx="117" cy="187" r="3.5" fill="#c9c2ff" />
                <circle cx="206" cy="207" r="3.5" fill="#8deaff" />
            </g>

            <g className="chat-welcome-artwork__spark chat-welcome-artwork__spark--one">
                <path d="M247 58L251 67L260 71L251 75L247 84L243 75L234 71L243 67L247 58Z" fill="#b8afff" />
            </g>
            <g className="chat-welcome-artwork__spark chat-welcome-artwork__spark--two">
                <circle cx="66" cy="193" r="5" fill="#72dcff" />
                <circle cx="66" cy="193" r="10" fill="none" stroke="#72dcff" strokeOpacity="0.25" />
            </g>
            <path
                className="chat-welcome-artwork__accent"
                d="M270 105C280 101 287 94 290 84"
                fill="none"
                stroke="#9285f8"
                strokeLinecap="round"
                strokeWidth="3"
            />
        </svg>
    </div>
);

export default ChatWelcomeArtwork;
