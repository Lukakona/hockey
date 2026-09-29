

'use client';
import React, { useEffect, useState } from 'react';

export default function Footer({
    onInfoClick
}: {
    onInfoClick: () => void
}) {
  return (
    <footer className="bg-neutral-primary-soft rounded-base shadow-xs border-2 border-black m-4">
        <div className="w-full mx-auto max-w-screen-l p-4 md:flex md:items-center md:justify-between">
        <span className="text-sm text-body text-black sm:text-left">~~ made wif luv from LUKAKONA ~~
        </span>
        <span className="text-sm text-body text-black sm:text-center hover:underline"><a target="_blank" href='https://ko-fi.com/lukakona'>Like the site? Consider buying me a coffee!</a>
        </span>
        <ul className="flex flex-wrap items-center mt-3 text-sm font-medium text-body sm:mt-0">
            <li>
                <button onClick={onInfoClick} className="hover:underline text-black me-4 md:me-6">What is this?</button>
            </li>
            <li>
                <a href="http://lukakona.online" className="hover:underline text-black">Bluesky</a>
            </li>
        </ul>
        </div>
    </footer>
  );
}
