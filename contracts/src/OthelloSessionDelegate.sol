// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IOthelloGame {
    function makeMove(uint256 gameId, uint8 position) external;
}

/// @notice EIP-7702 delegation target. EOAs point their code at this
///         implementation so a browser-held session key can submit moves
///         without per-move wallet confirmations. Storage lives on the EOA.
contract OthelloSessionDelegate {
    struct Session {
        address game;
        uint256 gameId;
        address sessionKey;
        uint256 expiryBlock;
        bool active;
    }

    Session public session;

    error SessionExpired();
    error NotSessionKey();
    error SessionNotActive();
    error NotOwner();

    /// @notice Called by the player's EOA itself (7702 context). In that
    ///         context address(this) IS the EOA, so only the EOA can
    ///         register or revoke its own session.
    function registerSession(address game, uint256 gameId, address sessionKey, uint256 durationBlocks) external {
        if (msg.sender != address(this)) revert NotOwner();
        session = Session({
            game: game, gameId: gameId, sessionKey: sessionKey, expiryBlock: block.number + durationBlocks, active: true
        });
    }

    /// @notice Called by the session key (from the browser) to submit a move.
    ///         Runs in the EOA's context, so the game sees msg.sender = EOA.
    function executeMove(uint8 position) external {
        if (msg.sender != session.sessionKey) revert NotSessionKey();
        if (!session.active) revert SessionNotActive();
        if (block.number > session.expiryBlock) revert SessionExpired();

        IOthelloGame(session.game).makeMove(session.gameId, position);
    }

    /// @notice Player can revoke at any time (EOA self-call only).
    function revokeSession() external {
        if (msg.sender != address(this)) revert NotOwner();
        session.active = false;
    }
}
