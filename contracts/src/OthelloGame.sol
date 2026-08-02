// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Interfaces.sol";

contract OthelloGame is Ownable {
    struct Player{
        address playerAddr;
        uint64 dailyCount;
        uint256 lastPlayed;
        uint256 stake;
    }

    enum Status {
        PENDING,
        ACTIVE,
        FINISHED
    }

    struct Game {
        uint64 blackBits;
        uint64 whiteBits;
        Player p1;
        Player p2;
        Status status;
        bool blackToMove;
        uint256 lastMoveBlock;
    }

    // Occupied positions:
    // Black: 28, 35
    // White: 27, 36
    uint64 constant INIT_BLACK_BITBOARD = 0x0000000810000000;
    uint64 constant INIT_WHITE_BITBOARD = 0x0000001008000000;
    IERC20 immutable YYG_TOKEN;
    IOthelloELO immutable OthelloELO_Contract;
    IOthelloTreasury immutable othelloTreasury;

    constructor(address yyg, address othelloELO, address treasuryAddr, address initialOwner) Ownable(initialOwner){
        YYG_TOKEN = IERC20(yyg);
        OthelloELO_Contract = IOthelloELO(othelloELO);
        othelloTreasury = IOthelloTreasury(treasuryAddr);
        nextGameId = 0;
    }

    function getInitBitboards() internal pure returns(uint64 black, uint64 white){
        black = INIT_BLACK_BITBOARD;
        white = INIT_WHITE_BITBOARD;
    }

    /// @notice Occupancy checker of a position in board
    /// @dev Notes:
    /// - Right-shift bits "pos" times
    /// - use bitwise AND with 1 to return occupancy value
    /// @param bits the Bitboard
    /// @param pos the position to check
    /// @return occupancy occupancy of the position
    function _isOccupied(uint64 bits, uint8 pos) internal pure returns (bool occupancy){
        return (bits >> pos) & 1 == 1;
    }

    /// @notice Occupancy setter of a position in board
    /// @dev Notes:
    /// - Left-shift 1 "pos" times, creating a bitmask at "pos" position with value 1
    /// - use bitwise OR to set the bit at "pos" to 1 if not already set
    /// @param bits the Bitboard
    /// @param pos the position to check
    /// @return updatedBits updated Bitboard
    function _setBit(uint64 bits, uint8 pos) internal pure returns (uint64 updatedBits){
        return bits | ((uint64)(1) << pos);
    }

    uint64 constant NO_EAST_WRAP = 0x7F7F7F7F7F7F7F7F; // column 7 cleared in every row
    uint64 constant NO_WEST_WRAP = 0xFEFEFEFEFEFEFEFE; // column 0 cleared in every row
    uint64 constant NO_MASK = 0xFFFFFFFFFFFFFFFF; // pure N/S, no wrapping possible
    function _flipsInDirection(uint64 myBits, uint64 opBits, uint8 pos, int8 shift, uint64 wrapMask) internal pure returns(uint64 candidates){
        candidates = 0; // bits we might flip
        uint64 cursor = uint64(1) << pos; // single bit at our position

        for(uint8 i=0; i<8; i++){
            // applyShift: if shift > 0, cursor << shift; else cursor >> (-shift)
            cursor = (shift>0) ? ((cursor & wrapMask) << uint8(shift)) : ((cursor & wrapMask) >> uint8(-shift));
            if (cursor == 0){
                return 0;   // fell off the board
            }
            if (cursor & opBits != 0){
                candidates |= cursor;   // p2 piece, add to candidates
                continue;
            }
            if (cursor & myBits != 0){
                return candidates;   // p1 piece, valid flip line
            }

            return 0;    // empty square, nothing flips
        }
    }

    function _getFlips(uint64 myBits, uint64 opBits, uint8 pos) internal pure returns (uint64 flipMask){
    flipMask = 0;
        flipMask |= _flipsInDirection(myBits, opBits, pos, 8, NO_MASK);    // S
        flipMask |= _flipsInDirection(myBits, opBits, pos, -8, NO_MASK);    // N
        flipMask |= _flipsInDirection(myBits, opBits, pos, 1, NO_EAST_WRAP);    // E
        flipMask |= _flipsInDirection(myBits, opBits, pos, -1, NO_WEST_WRAP);    // W
        flipMask |= _flipsInDirection(myBits, opBits, pos, 9, NO_EAST_WRAP);    // SE
        flipMask |= _flipsInDirection(myBits, opBits, pos, -9, NO_WEST_WRAP);    // NW
        flipMask |= _flipsInDirection(myBits, opBits, pos, 7, NO_WEST_WRAP);    // SW
        flipMask |= _flipsInDirection(myBits, opBits, pos, -7, NO_EAST_WRAP);    // NE
        return flipMask;
    }

    mapping(uint256 gameId => Game) public games;
    uint256 public nextGameId;

    uint256 dayIndex;
    uint64 constant DAILY_CAP = 20;
    uint256 constant MIN_STAKE = 10;
    mapping(uint256 dayIdx => mapping(address player => Player)) public dailyGamesCap;
    error Exceeded_Daily_Cap(uint256 waitTime);
    mapping(address player => mapping(address opponent => uint256 lastPlayed)) public cooldownPerOpponent;
    error Cooldown_Valid(uint256 waitTime);
    mapping(address challenger => address[] opponents) public contestantHistory;

    function antiFarmingChecksHelper(address opponent) internal returns (bool){
        if(block.timestamp/86400 > dayIndex){
            dayIndex = block.timestamp/86400;
        }
        Player memory Challenger = dailyGamesCap[dayIndex][msg.sender];
        if(Challenger.dailyCount >= DAILY_CAP){
            revert Exceeded_Daily_Cap({
                waitTime: (block.timestamp - Challenger.lastPlayed)/86400
            });
        }
        if(cooldownPerOpponent[msg.sender][opponent] > 0 && block.timestamp < cooldownPerOpponent[msg.sender][opponent]+3600){
            revert Cooldown_Valid({
                waitTime: cooldownPerOpponent[msg.sender][opponent] + 3600 - block.timestamp
            });
        }

        return true;
    }

    function createGame(address opponent, uint256 challengerStakeAmount) public {
        antiFarmingChecksHelper(opponent);
        Player memory Challenger = dailyGamesCap[dayIndex][msg.sender];
        Player memory Opponent = dailyGamesCap[dayIndex][opponent];
        Challenger.stake = challengerStakeAmount;
        require(Challenger.stake >= MIN_STAKE, "Minimum amount to stake for a match is 10 YYG");

        bool check = YYG_TOKEN.transferFrom(msg.sender, address(this), Challenger.stake);
        require(check, "Stake transfer unsuccessful");

        Game storage game = games[nextGameId];
        game.status = Status.PENDING;
        game.p1 = Challenger;
        game.p2 = Opponent;
        game.p1.playerAddr = msg.sender;
        game.p2.playerAddr = opponent;
        nextGameId++;
    }

    modifier onlyOpponent(uint256 gameId) {
        require(msg.sender == games[gameId].p2.playerAddr, "Only the opponent can accept this game invitation");
        _;
    }

    function acceptGame(uint256 gameId, uint256 opponentStakeAmount) public onlyOpponent(gameId){
        require(games[gameId].status == Status.PENDING, "Game status invalid (!= PENDING");
        Player memory Challenger = games[gameId].p1;
        Player memory Opponent = games[gameId].p2;
        Opponent.stake = opponentStakeAmount;
        games[gameId].p2.stake = opponentStakeAmount;

        antiFarmingChecksHelper(Challenger.playerAddr);

        bool check = YYG_TOKEN.transferFrom(Opponent.playerAddr, address(this), Opponent.stake);
        require(check, "Stake transfer unsuccessful");

        games[gameId].status = Status.ACTIVE;
        games[gameId].blackBits = INIT_BLACK_BITBOARD;
        games[gameId].whiteBits = INIT_WHITE_BITBOARD;
        games[gameId].blackToMove = true;

        // Anti-farming state updates
        dailyGamesCap[dayIndex][Challenger.playerAddr].dailyCount++;
        dailyGamesCap[dayIndex][Opponent.playerAddr].dailyCount++;
        cooldownPerOpponent[Challenger.playerAddr][Opponent.playerAddr] = block.timestamp;
        cooldownPerOpponent[Opponent.playerAddr][Challenger.playerAddr] = block.timestamp;
    }

    function _hasLegalMove(uint64 myBits, uint64 opBits) internal pure returns(bool) {
        for(uint8 pos=0; pos<64; pos++){
            if(!_isOccupied((myBits|opBits), pos) && _getFlips(myBits, opBits , pos) != 0){
                return true;
            }
        }

        return false;
    }

    function makeMove(uint256 gameId, uint8 pos) public {
        require(games[gameId].status == Status.ACTIVE, "Game must be created and accepted in order to make a move!");

        uint64 myBits;
        uint64 opBits;

        if(games[gameId].blackToMove == true){
            require(msg.sender == games[gameId].p1.playerAddr, "You must wait for the other player to move!");

            myBits = games[gameId].blackBits;
            opBits = games[gameId].whiteBits;
        } else {
            require(msg.sender == games[gameId].p2.playerAddr, "You must wait for the other player to move!");

            myBits = games[gameId].whiteBits;
            opBits = games[gameId].blackBits;
        }

        uint64 flips = _getFlips(myBits, opBits, pos);
        require(!(_isOccupied(myBits, pos) || _isOccupied(opBits, pos)), "Position selected is non-empty!");
        require(flips != 0, "Illegal Move");

        uint64 bit = uint64(1) << pos;
        myBits = myBits | flips | bit;
        opBits = opBits ^ flips;
        if(games[gameId].blackToMove == true){
            games[gameId].blackBits = myBits;
            games[gameId].whiteBits = opBits;
        } else {
            games[gameId].whiteBits = myBits;
            games[gameId].blackBits = opBits;
        }

        games[gameId].blackToMove = !games[gameId].blackToMove;
        games[gameId].lastMoveBlock = block.number;

        if((myBits|opBits) == 0xFFFFFFFFFFFFFFFF){
            _settle(gameId);
        } else {
            if(!_hasLegalMove(opBits, myBits)){
                if(!_hasLegalMove(myBits, opBits)){
                    // Both players do not have legal moves, finalize the game
                    _settle(gameId);
                } else {
                    // Other player has no legal moves => pass back to current player
                    games[gameId].blackToMove = !games[gameId].blackToMove;
                }
            }
        }
    }

    /// @notice Counts number of bits that are 1 in a 64-bit number
    /// @dev Notes:
    /// - 64-bit input x e.g. 0b...10110011... - we want to count every 1-bit
    /// - Line 1 - count pairs x = x − ((x >> 1) & 0x5555555555555555) mask = 0101… each 2-bit chunk now holds the count of 1s in that chunk (0–2)
    /// - Line 2 - merge pairs to nibbles x = (x & 0x3333333333333333) + ((x >> 2) & 0x3333333333333333) mask = 0011… each 4-bit nibble now holds count of 1s in that nibble (0–4)
    /// - Line 3 - merge nibbles to bytes x = (x + (x >> 4)) & 0x0F0F0F0F0F0F0F0F mask = 00001111… each byte now holds count of 1s in that byte (0–8)
    /// Line 4 - sum all 8 bytes via multiply trick × 0x0101010101010101, accumulates all bytes into top byte to >> 56 extracts it
    /// @param x Bitboard to evaluate
    /// @return bits number of bits that are 1
    function popcount(uint64 x) internal pure returns (uint8) {
        uint256 w = x; // widened so intermediate sums cannot overflow
        w = w - ((w >> 1) & 0x5555555555555555);
        w = (w & 0x3333333333333333) + ((w >> 2) & 0x3333333333333333);
        w = (w + (w >> 4)) & 0x0F0F0F0F0F0F0F0F;
        return uint8((w * 0x0101010101010101) >> 56);
    }

    function distinctOpponents(address player) internal view returns (bool) {
        address[] memory history = contestantHistory[player];
        uint256 len = history.length;

        uint8 start = uint8(len>10 ? len-10 : 0);
        uint256 distinctCount = 0;

        address[10] memory seen;

        for(uint8 i=start; i<len; i++){
            address opp = history[i];
            bool alreadySeen = false;

            for(uint8 j=0; j<distinctCount; j++){
                if (seen[j] == opp) {
                    alreadySeen = true;
                    break;
                }
            }

            if (!alreadySeen) {
                seen[distinctCount] = opp;
                distinctCount++;
                if (distinctCount >= 3) return true;
            }
        }

        return false;
    }

    // Reentrancy guard
    uint256 private _locked = 1;
    modifier lock() {
        require(_locked == 1, "Reentrancy");
        _locked = 2;
        _;
        _locked = 1;
    }

    function _settle(uint256 gameId) internal lock{
        uint64 BlackBitboard = games[gameId].blackBits;
        uint64 WhiteBitboard = games[gameId].whiteBits;
        Player memory Challenger = games[gameId].p1;
        Player memory Opponent = games[gameId].p2;
        uint256 challengerELO = OthelloELO_Contract.getELO(Challenger.playerAddr);
        uint256 opponentELO = OthelloELO_Contract.getELO(Opponent.playerAddr);
        uint256 eloDiff = uint256((int256(challengerELO) - int256(opponentELO))>0 ? (int256(challengerELO) - int256(opponentELO)) : (int256(opponentELO) - int256(challengerELO)));
        uint256 gameStake = Challenger.stake+Opponent.stake;

        uint8 blackCount = popcount(BlackBitboard);
        uint8 whiteCount = popcount(WhiteBitboard);

        // History updates
        games[gameId].status = Status.FINISHED;
        contestantHistory[Challenger.playerAddr].push(Opponent.playerAddr);
        contestantHistory[Opponent.playerAddr].push(Challenger.playerAddr);

        if(eloDiff <= 400e18){
            if (blackCount > whiteCount) {
                bool check = YYG_TOKEN.transfer(Challenger.playerAddr, gameStake*96/100);
                require(check, "Failed to settle Challenger stake");

                YYG_TOKEN.approve(address(othelloTreasury), gameStake*4/100);
                othelloTreasury.receive4Percent(gameStake*4/100);

                if(distinctOpponents(Challenger.playerAddr) && distinctOpponents(Opponent.playerAddr)){
                    OthelloELO_Contract.recordResult(Challenger.playerAddr, Opponent.playerAddr);
                }
            }
            else if (whiteCount > blackCount) {
                bool check = YYG_TOKEN.transfer(Opponent.playerAddr, gameStake*96/100);
                require(check, "Failed to settle Opponent stake");

                YYG_TOKEN.approve(address(othelloTreasury), gameStake*4/100);
                othelloTreasury.receive4Percent(gameStake*4/100);

                if(distinctOpponents(Opponent.playerAddr) && distinctOpponents(Challenger.playerAddr)){
                    OthelloELO_Contract.recordResult(Opponent.playerAddr, Challenger.playerAddr);
                }
            }
            else {
                // In case of draw, both players get back 96% of their stakes, while the treasury keeps the rest

                bool check = YYG_TOKEN.transfer(Challenger.playerAddr, Challenger.stake*96/100);
                require(check, "Failed to settle Challenger stake");
                check = YYG_TOKEN.transfer(Opponent.playerAddr, Opponent.stake*96/100);
                require(check, "Failed to settle Opponent stake");

                YYG_TOKEN.approve(address(othelloTreasury), gameStake*4/100);
                othelloTreasury.receive4Percent(gameStake*4/100);
            }
        } else {
            // In case of a big ELO diff, we prioritise ELO changes more than stake reward (which can be gamed, and the lower rated player has a 10% chance of winning according to ELO calculations, so the higher rated one is sure to win approx. 9 out of 10 games), hence we just return both players 96% of their stakes back and keep the rest in treasury
            // As we have implemented the distinctOpponents checker, gaming the system to make player's alt accounts get more ELO fast would now be heavily difficult since it would need atleast 3 distinct addresses to play the games against, and still lose most money to the treasury

            bool check = YYG_TOKEN.transfer(Challenger.playerAddr, Challenger.stake*96/100);
            require(check, "Failed to settle stake");
            check = YYG_TOKEN.transfer(Opponent.playerAddr, Opponent.stake*96/100);
            require(check, "Failed to settle stake");

            YYG_TOKEN.approve(address(othelloTreasury), gameStake*4/100);
            othelloTreasury.receive4Percent(gameStake*4/100);

            if(distinctOpponents(Challenger.playerAddr) && distinctOpponents(Opponent.playerAddr)){
                if (blackCount > whiteCount) {
                    OthelloELO_Contract.recordResult(Challenger.playerAddr, Opponent.playerAddr);
                }
                else if (whiteCount > blackCount) {
                    OthelloELO_Contract.recordResult(Opponent.playerAddr, Challenger.playerAddr);
                }

                // for draw, there's nothing to do since we have already transferred both their stakes back
            }
        }
    }
}

contract OthelloGameHarness is OthelloGame {
	constructor(address yyg, address elo, address treasury, address initialOwner) OthelloGame(yyg, elo, treasury, initialOwner) {}
	function settle(uint256 id) external { _settle(id); }
	function seedBoard(uint256 id, uint64 b, uint64 w) external {
	    games[id].blackBits = b;
		games[id].whiteBits = w;
		games[id].status = Status.ACTIVE;
		games[id].blackToMove = true;
		games[id].lastMoveBlock = block.number;
	}
	function seedStake(uint256 id, address p1, uint256 s1, address p2, uint256 s2) external {
	    games[id].p1.playerAddr = p1;
		games[id].p2.playerAddr = p2;

		games[id].p1.stake = s1;
		games[id].p2.stake = s2;

		games[id].p1.dailyCount = 0;
		games[id].p2.dailyCount = 0;
		games[id].p1.lastPlayed = 0;
		games[id].p2.lastPlayed = 0;
	}
	function record(uint256 id) external view returns(uint64 BlackBitboard, uint64 WhiteBitboard, Status gameStatus, address winner){
	    BlackBitboard = games[id].blackBits;
		WhiteBitboard = games[id].whiteBits;
	    uint8 blackCount = popcount(BlackBitboard);
        uint8 whiteCount = popcount(WhiteBitboard);
        gameStatus = games[id].status;
        winner = (blackCount>whiteCount) ? games[id].p1.playerAddr : games[id].p2.playerAddr;
        if(blackCount == whiteCount){
            winner = address(0);
        }
	}
}
