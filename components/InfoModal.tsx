import { useRef } from 'react';

export default function InfoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-w-lg min-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <div className="flex items-center justify-end">
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>
        <h1 className="text-center text-xl">
          Thanks for checking out my site!
          <br />I made this page in case you're lost.
        </h1>
        <details>
          <summary className="pt-8 text-xl font-bold">What is this site?</summary>
          BlueLine Hockey is a sports tracking / prediction game, specifically for the National
          Hockey League (NHL). This app queries all NHL games for the week, and displays them by
          their date.
          <br />
          For users who have favorite teams, you can save teams for a quicker 'at a glance'
          schedule. Click on any game to see additional details!
          <br />
          <br />
          In addition, users authenticated via Bluesky (or any ATmosphere app) can use the 'betting'
          features, detailed below!
        </details>
        <details>
          <summary className="pt-8 text-xl font-bold">Is this a sports betting app?</summary>
          Not <i>really.</i>
          <br />
          <br />
          Users with an authenticated Bluesky/ATmosphere account can log in, and will be given a
          virtual currency.
          <br />
          <br />
          This currency can then be used to place wagers on the outcome of games, and players will
          be tracked on a leaderboard to showcase the best predictors.
          <br />
          <br />
          There is, and will never be a way to translate your fake hockey money to anything else.
          There is also no way to purchase the fake hockey money.
          <br />
          <br />
          I do not endorse sports betting, and you shouldn't do it lol.
          <br />
          <br />
          If you have a gambling / sports betting problem, I am <i>begging</i> you to go to{' '}
          <a className="font-bold hover:underline" href="https://www.1800gambler.net">
            a help network like this
          </a>
          .
        </details>
        <details>
          <summary className="pt-8 text-xl font-bold">How do I play?</summary>
          First, authenticate with a Bluesky/ATmosphere account. If you don't have one, sorry. I'm
          lazybones so it's the only auth tool at the moment.
          <br />
          <br />
          Once you log in, you'll be given an initial stash of <b>Pucks</b>. Go ahead and try to
          predict who's going to win all of today's games!
          <br />
          <br />
          You can click into a game to see some extra details, or you can just do a quick-wager on
          the main page.
          <br />
          <br />
          <b>
            <i>Out of Pucks?</i>
          </b>
          <br />
          Jump over to the <i>Fantasy Idle</i> mode!
          <br />
          <br />
          In this mode, you can build your own team. Select one player for each position across the
          entire NHL, and if they do well, you'll passively gain Pucks to use in wagers!
          <br />
          <br />
          Give it a try, and most importantly, go watch some hockey!!
        </details>
        <br />
        I made this app because I'm a very passionate hockey fan.
        <br />
        <br />
        If you've never given it a try and have a few mins, go watch a live game!
      </div>
    </div>
  );
}
