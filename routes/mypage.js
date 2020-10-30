const express = require("express");
const router = express.Router();
const request = require("request");
const bodyParser = require("body-parser");
const path = require("path");

/* Import Database Settings */
const db = require("../lib/db");
let User = require('../lib/models/userModel');
let Repo = require('../lib/models/repoModel');
let Counter = require('../lib/models/counterModel');
let ChatRoom = require('../lib/models/chatRoomsModel');

router.use(bodyParser.json());
router.use(express.static(path.join(__dirname, "public")));

/* Session Check Function */
let sessionCheck = (req, res, next) => {
  if ((Object.keys(req.session.passport).length === 0 && req.session.passport.constructor === Object || req.session.passport.user.username !== req.params.userId)) {
    res.render('customError', {
      errorExplain: `You cannot access this page or perform tasks. Login data and Session data mismatching`,
      errorMessage: 'Invalid Access Error',
    });
  } else if ((Object.keys(req.session.passport).length !== 0 && req.session.passport.constructor !== Object) || req.session.passport.user.username === req.params.userId) {
    next();
  }
}

/* GET MyPage Page */
router.get(`/:userId/admin/mypage`, async (req, res, next) => {
  let userId = req.params.userId;
  let finalArray;

  /* Chart Data Process */
  try {
    let chartArray = [];
    let chartData = [];

    for (let i = 0; i < 7; i++) {
      let d = new Date();
      d.setDate(d.getDate() - i);
      chartArray.push(d.toISOString().substr(0, 10).replace('T', ''));
      // console.log(chartArray[i])

      await Counter.aggregate([{
          $match: {
            userName: userId,
            viewDate: chartArray[i],
          }
        },
        {
          $group: {
            _id: null,
            count: {
              $sum: "$count"
            }
          }
        }
      ], (err, viewData) => {
        if (err) throw err;
        if (viewData.length == 0) {
          viewData = 0;
        } else {
          viewData = viewData[0].count;
        }
        chartData.push(viewData);
        console.log(chartData);
      });
    }
    finalArray = chartData;
    console.log('After all the queries: ', chartData);
  } catch (e) {
    // throw an error
    throw e;
  }

  let todayDate = new Date().toISOString().substr(0, 10).replace('T', '')
  let userNumber;
  let updatedTime = new Date(); // updated Time Variable

  /* DataTables Data Process*/
  Repo.find({
    'owner.login': userId
  }, (err, repo) => {
    if (err) throw err;
    userNumber = repo[0].owner.id;

    let languageNameArray = require('../config/languageNames')
    repo.map((repo) => {
      {
        let imageName = (repo.language || '').toLowerCase();
        /* If AWS Image Exists */
        if (repo.imageURL) {
          // console.log('Use AWS Image')
        } else if (languageNameArray.includes(imageName) == false) {
          repo.imageURL = `/images/app/${repo.projectType}.png`
        } else if (languageNameArray.includes(imageName) == true) {
          let lowercaseLanguage = (repo.language || '').toLowerCase().replace(/\+/g, '%2B').replace(/\#/g, "%23");
          repo.imageURL = `https://portfolioworld.s3.ap-northeast-2.amazonaws.com/devicon/${lowercaseLanguage}/${lowercaseLanguage}-original.svg`
        } else if (repo.language == null && repo.imageURL == null) {
          repo.imageURL = `/images/app/${repo.projectType}.png`
        }
        repo.homepage = repo.homepage || 'None'
        repo.language = repo.language || 'None'
      }
    })

    /* Total Views Count Process */
    Counter.aggregate([{
        $match: {
          userName: userId,
          userNumber: userNumber
        }
      },
      {
        $group: {
          _id: null,
          count: {
            $sum: "$count"
          }
        }
      }
    ], (err, totalViews) => {
      if (err) throw err;
      if (totalViews.length == 0) {
        totalViews = 0;
      } else {
        totalViews = totalViews[0].count || 0;
      }

      /* Today Visitors Count Process */
      Counter.aggregate([{
          $match: {
            userName: userId,
            userNumber: userNumber,
            viewDate: todayDate,
          }
        },
        {
          $group: {
            _id: null,
            count: {
              $sum: "$count"
            }
          }
        }
      ], (err, todayVisitors) => {
        if (err) throw err;
        if (todayVisitors.length === 0) {
          todayVisitors = 0;
        } else {
          todayVisitors = todayVisitors[0].count
        }
        res.render('mypage/main', {
          userId: userId,
          dataArray: repo,
          todayVisitors: todayVisitors,
          chartData: finalArray,
          chartMaxData: Math.max.apply(null, finalArray), // Use in Chart Max line
          totalViews: totalViews,
          updatedTime: updatedTime.toLocaleString()
        })
      })
    })
  })
})

/* GET Mypage Remove Portfolio Data */
router.get(`/:userId/admin/removeData`, sessionCheck, (req, res, next) => {
  let userId = req.params.userId;

  /* Remove Repository Process */
  Repo.deleteMany({
    'owner.login': userId
  }, (err, result) => {
    if (err) {
      res.json('{fail}');
    } else {
      res.json('{success}');
    }
  })
  /* Remove Counter Data Process */
  Counter.deleteMany({
    'userName': userId
  }, (err, result) => {
    if (err) {
      res.json('{fail}');
    } else {
      res.json('{success}');
    }
  })
});

/* GET Mypage Get Github Portfolio Data */
router.get(`/:userId/admin/getData`, sessionCheck, (req, res, next) => {
  let userId = req.params.userId;
  request({
    headers: {
      'User-Agent': 'request',
      'accept': 'application/vnd.github.VERSION.raw',
      'Authorization': `token ${process.env.GITHUB_DATA_ACCESS_TOKEN}`,
      'charset': 'UTF-8'
    },
    json: true,
    url: `https://api.github.com/users/${userId}/repos?per_page=100`,
  }, (error, response, data) => {
    console.log(response.statusCode)
    if (response.statusCode == 200) {
      res.json('{success}')
    } else {
      res.json('{fail}')
    }
    if (error) throw error;
    for (i in data) {
      if (data.length == 0 || data[i].fork == false) {
        Repo.insertMany(data[i], (err, result) => {
          if (err) throw err;
        })
      }
    }
  })
})

/* GET Mypage User Setting Page */
router.get(`/:userId/admin/user`, sessionCheck, (req, res, next) => {
  let userId = req.params.userId;
  User.find({
    'login': userId
  }, function (err, userData) {
    if (err) throw err;
    userData = userData[0];
    res.render('mypage/user', {
      userId: userData.login,
      uniqueId: `${userData._id}-${userData.id}`,
      avatarUrl: userData.avatar_url,
      name: userData.name,
      bio: userData.bio,
      email: userData.email,
      phoneNumber: userData.phoneNumber,
      registerDate: userData.created_at
    })
  })
})

/* POST Mypage User Setting Page */
router.post(`/:userId/admin/submit`, function (req, res, next) {
  let userId = req.params.userId;
  let email = req.body.email;
  let phoneNumber = req.body.phoneNumber;
  let bio = req.body.bio;
  console.log(email + phoneNumber + bio)
  User.findOneAndUpdate({
    'login': userId,
  }, {
    $set: {
      email: email,
      phoneNumber: phoneNumber,
      bio: bio
    },
  }, {
    useFindAndModify: false
  }, (err, result) => {
    if (err) throw err;
    res.json(result);
  })
})

//-------------------------------------------------------------------------------------------------------------

/* MyPage User Chat Room */
router.get(`/:userId/admin/contact`, async (req, res) => {
  try {
    let userId = req.params.userId;



    let chatRoomData = await ChatRoom.find({
      'participant': userId
    })
    let userData = await User.find({
      'login': chatRoomData[0].participant
    })
    console.log(delete userData)


    res.render('mypage/contact', {
      userId: userId,
      userData,
    })

  } catch (err) {
    throw err;
  }


  // console.log(loginedId)

  //   let roomData = await ChatRoom.find({}).or([{
  //     'chatSender': userId
  //   }, {
  //     'chatReceiver': userId
  //   }])
  //   console.log(roomData)
  //   // console.log(good)
  //   let chatUserData = [];

  // roomData.forEach((roomData) => {
  //   chatUserData.push(roomData.chatReceiver)
  // })
  // console.log(chatUserData.reverse())
  //   let profileImageData = await User.find({'login':chatUserData}, 'id login avatar_url')
  //   // console.log(profileImageData)


  //   console.log(roomData.concat(profileImageData))

  // res.render('mypage/contact', {
  // userId: userId,
  // loginedId: loginedId,
  // roomData,
  // profileImageData
  // })
  // })
  // })

});

/* GET Privious Chat Data Router */
router.get(`/:userId/:joinedRoomName/admin/getPreviousChat`, function (req, res, next) {
  let userId = req.params.userId;
  let joinedRoomName = req.params.joinedRoomName;
  console.log(`PREVIOUS CHAT DATA ROOM : ${joinedRoomName}`);
  db.query(`SELECT * FROM chatData WHERE roomName=?`, [joinedRoomName], function (error, data) {
    if (error) {
      throw error;
    }
    // Recreate Date Type
    for (let i = 0; i < data.length; i++) {
      data[i].chatDate = data[i].chatDate.toLocaleString()
    }
    res.send(data);
  });
});

/* MyPage User Chat Room */
router.get(`/:userId/contact`, async (req, res) => {
  try {
    let userId = req.params.userId;
    let loginedId = req.user.username;
    let roomName = '';

    let userNumber = await User.find({
      'login': [loginedId, userId]
    }, 'id login')

    userNumber.forEach((userNumber) => {
      roomName += `${userNumber.id}/`
    })
    console.log(roomName);

    let roomExistCheck = await ChatRoom.find({
      'roomName': roomName
    })
    console.log(roomExistCheck)

    if (roomExistCheck.length === 0) {
      await ChatRoom.create({
        'roomName': roomName,
        'participant': [loginedId, userId],
        'chatSender': loginedId,
        'chatReceiver': userId
      })
    }
    res.redirect(`/${loginedId}/admin/contact`)


    // res.redirect(`/${loginedId}/admin/contact`)
    // let possibleRoomName = [loginedId, userId];
    // let possibleRoomNameSecond = [userId, loginedId];

    // console.log(possibleRoomName)
    // console.log(possibleRoomNameSecond)
    // let roomExistCheck = await ChatRoom.find({}).or([{
    //   'roomName': possibleRoomName
    // }, {
    //   'roomName': possibleRoomNameSecond
    // }])
    // console.log(roomExistCheck.roomName)
    // if (roomExistCheck.length === 0) {
    //   await ChatRoom.create({
    //     'roomName': new Array(possibleRoomName),
    //     'chatSender': loginedId,
    //     'chatReceiver': userId
    //   })
    //   res.redirect(`/${loginedId}/admin/contact`)
    // }
    // console.log(roomExistCheck)

    // let result = roomExistCheck
    // db.query(`SELECT * FROM chatroom WHERE roomName=? OR roomName=?`, [roomName], function (err, roomCheck) {
    //   if (err) {
    //     throw `Error from /:userId/contact Router \n${err}`
    //   }
    //   // Checks Room Exist
    //   if (roomCheck[0] === undefined) {
    //     // Create Room
    //     db.query(`INSERT INTO chatroom (roomName, chatReceiver, chatSender) VALUES (?,?,?)`, [roomName, userId, loginId])
    //   }
    //   res.redirect(`/${loginId}/admin/contact`)
    // })
    // }
  } catch (err) {
    throw err;
  }
});

module.exports = router;