const express = require("express");
const router = express.Router();
const db = require("../lib/db");
const request = require("request");
const shortid = require("shortid");
const bodyParser = require("body-parser");

/* GET MyPage Page */
router.get(`/:userId/admin/mypage`, function (req, res, next) {
    let userId = req.params.userId; // UserID Variable
  
    let updatedTime = new Date(); // updated Time Variable
    let currentDay = new Date();
    let theYear = currentDay.getFullYear();
    let theMonth = currentDay.getMonth();
    let theDate = currentDay.getDate();
    let thisWeek = [];
    for (let i = 0; i < 7; i++) {
      let resultDay = new Date(theYear, theMonth, theDate - i);
      let yyyy = resultDay.getFullYear();
      let mm = Number(resultDay.getMonth()) + 1;
      let dd = resultDay.getDate();
      mm = String(mm).length === 1 ? '0' + mm : mm;
      dd = String(dd).length === 1 ? '0' + dd : dd;
      thisWeek[i] = yyyy + '-' + mm + '-' + dd;
    }
    // Chart Data SQL
    db.query(`SELECT * FROM project WHERE userId='${userId}'`, function (error, data) {
      if (error) {
        throw (`Error From Router /:userId/mypage \n ${error}`);
      }
      for (var i = 0; i < data.length; i++) {
        if (data[i].imageUrl === null) {
          data[i].imageUrl = '/images/app/404.png'
        }
      }
      data.forEach(results => {
        let date1 = results.projectDate1;
        let date2 = results.projectDate2;
        results.projectDate1 = date1;
        results.projectDate2 = date2;
      })
      // Total Counter SQL
      db.query(`SELECT SUM(counter) FROM counter WHERE userId='${userId}'`, function (error, counterSum) {
        if (error) {
          throw (`Error FROM Router /:userId/mypage \n ${error}`);
        }
        //  This Week visitor Data SQL
        db.query(`SELECT counter FROM counter WHERE userId='${userId}' AND (date=? OR date=? OR date=? OR date=? OR date=? OR date=? OR date=?)`, thisWeek, function (error, visitorData) {
          if (error) {
            throw (`Error From Router /:userId/mypage \n ${error}`);
          }
          db.query(`SELECT counter FROM counter WHERE userId='${userId}' AND date=?`, [currentDay.toISOString().split('T')[0]], function (error, todayVisitorData) {
            if (error) {
              throw (`Error From Router /:userId/mypage \n ${error}`);
            }
            if (todayVisitorData[0] === undefined) {
              todayVisitorData[0] = 0;
              db.query(`INSERT INTO counter (userId, date, counter) VALUES (?,?,?)`, [userId, currentDay.toISOString().split('T')[0], 0])
            }
            let chartData = [];
            if (visitorData.length < 7) { // If visitor data's length is lower than 7, Push Data 0 to create Array
              for (let i = 0; i < 7 - visitorData.length; i++) {
                chartData.push(0);
              }
            }
            for (let i = 0; i < visitorData.length; i++) { // Create Counter Array for chart data
              chartData.push(visitorData[i].counter)
            }
            res.render('mypage/main', {
              userId: userId,
              dataArray: data,
              todayVisitor: todayVisitorData[0].counter,
              visitorData: chartData,
              chartMaxData: Math.max.apply(null, chartData), // Use in Chart Max line
              totalViews: counterSum[0]['SUM(counter)'],
              updatedTime: updatedTime.toLocaleString()
            })
          })
        })
      })
    })
  })
  
  /* GET Mypage Remove Portfolio Data */
  // TODO :: Needs to check the owner of the mypage and if not, avoid this job
  router.get(`/:userId/admin/removeData`, function (req, res, next) {
    let userId = req.params.userId;
    let currentDay = new Date();
    db.query(`DELETE FROM project WHERE userId='${userId}'`); // Delete project Table
    db.query(`DELETE FROM counter WHERE userId='${userId}'`); // Delete counter Table
    db.query(`INSERT INTO counter (userId, date, counter) VALUES (?,?,?)`, [userId, currentDay.toISOString().split('T')[0], 0]); // Reset Counter SQL to use INIT
    res.json('removed');
  });
  
  /* GET Mypage Get Github Portfolio Data */
  // TODO :: Needs to check the owner of the mypage and if not, avoid this job
  router.get(`/:userId/admin/getData`, function (req, res, next) {
    let userId = req.params.userId;
  
    db.query(`SELECT registerType FROM user WHERE loginId=?`, [userId], function (error, data) {
      if (error) {
        throw (`Error from Router /:userId/admin/getData Router \n ${error}`)
      }
      console.log(data[0].registerType);
      if (data[0].registerType === 'Google') {
        res.json('Type:Google')
      } else {
        // User Repository API Option Set
        console.log('GITHUB PROCESS');
        let repositoryOptions = {
          url: `https://api.github.com/users/${userId}/repos`,
          headers: {
            "User-Agent": "request"
          }
        }
        // User Repository Information API Process
        request(repositoryOptions, function (error, response, data) {
          if (error) {
            throw error;
          }
          let result = JSON.parse(data);
          for (i = 0; i < result.length; i++) {
            // console.log(result[i]);
            let sid = shortid.generate();
            let userId = result[i].owner.login;
            let projectName = result[i].name;
            let projectDemoUrl = result[i].homepage;
            let githubUrl = result[i].html_url;
            let summary = result[i].description;
            let projectDate1 = result[i].created_at;
            let projectDate2 = result[i].updated_at;
            let sqlData = [sid, userId, projectName, projectDemoUrl, githubUrl, summary, projectDate1.split('T')[0], projectDate2.split('T')[0]];
            let sql = `INSERT INTO project (sid, userId , projectName, projectDemoUrl, githubUrl, summary, projectDate1, projectDate2) VALUES (?,?,?,?,?,?,?,?)`;
            db.query(sql, sqlData);
          }
          db.query(`SELECT * FROM project WHERE userId='${userId}'`, function (error, redrawData) {
            if (error) {
              throw (`Error From Router /:userId/mypage \n ${error}`);
            }
            for (var i = 0; i < redrawData.length; i++) {
              if (redrawData[i].imageUrl === null) {
                redrawData[i].imageUrl = '/images/app/404.png'
              }
            }
            redrawData.forEach(results => {
              let date1 = results.projectDate1.split('T')[0];
              let date2 = results.projectDate2.split('T')[0];
              results.projectDate1 = date1;
              results.projectDate2 = date2;
            })
            res.json(redrawData);
          })
        })
      }
    })
  })
  
  /* GET Mypage User Setting Page */
  router.get(`/:userId/admin/user`, function (req, res, next) {
    let userId = req.params.userId;
    db.query(`SELECT * FROM user WHERE loginId='${userId}'`, function (error, data) {
      if (error) {
        throw (`Error From ${userId}/admin/user Router ${error}`);
      }
      let results = data[0];
      let uniqueId = `${results.loginId}-${results.registerType}`;
      res.render('mypage/user', {
        userId: userId,
        uniqueId: uniqueId,
        avatarUrl: results.avatarUrl,
        name: results.name,
        bio: results.bio,
        email: results.email,
        phoneNumber: results.phoneNumber,
        registerDate: results.registerDate
      })
    })
  })
  
  /* POST Mypage User Setting Page */
  router.post(`/:userId/admin/submit`, function (req, res, next) {
    let userId = req.params.userId;
    let email = req.body.email;
    let phoneNumber = req.body.phoneNumber;
    let bio = req.body.bio;
    // Update User Data SQL
    db.query(`UPDATE user SET email=?, phoneNumber=?, bio=? WHERE loginId=?`, [email, phoneNumber, bio, userId]);
    // Check Data From DB SQL
    db.query(`SELECT * FROM user WHERE loginId=?`, [userId], function (error, AjaxData) {
      if (error) {
        throw (`Error FROM /:userId/admin/user POST ROUTER : ${error}`);
      }
      res.json(AjaxData); // Return Data
    })
  })
  
  /* MyPage User Chat Room */
  router.get(`/:userId/admin/contact`, function (req, res, next) {
    let userId = req.params.userId;
    // let loginedId = req.user.loginId;
    let chatListImageArray = [];
    let profileImageArray = [];
    db.query(`SELECT * FROM chatRoom WHERE chatReceiver=? OR chatSender=?`, [userId, userId], function (error, room) {
      if (error) {
        throw `Error From /:userId/admin/contact ROUTER \n ERROR : ${error}`;
      }
      // db.query(`SELECT * FROM chatRoom WHERE chatReceiver=? OR chatSender=?`, [userId, userId], function (error, data) {
      //   if (error) {
      //     throw `Error From /:userId/admin/contact ROUTER \n ERROR : ${error}`;
      //   }
  
      // for (let i = 0; i < room.length; i++) {
      //   if (room[i].chatSender === userId) {
      //     chatListImageArray.push(room[i].chatReceiver)
      //   } else {
      //     chatListImageArray.push(room[i].chatSender)
      //   }
      // }
      // console.log(chatListImageArray); // Chat list Array
      // console.log(room)
  
      // for (let i = 0; i < chatListImageArray.length; i++) {
      //   db.query(`SELECT avatar_url FROM user WHERE login=?`, [chatListImageArray[i]], function (error, profileImage) {
      //     if (error) {
      //       throw error;
      //     }
      //     // console.log(profileImage)
      //     profileImageArray.push(profileImage[0].avatar_url)
      //     console.log(profileImageArray)
      //   })
      // }
      res.render('mypage/contact', {
        userId: userId,
        // loginedId: loginedId,
        room: room
        // profileImage: profileImageArray
        // })
      })
    });
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
  router.get(`/:userId/contact`, function (req, res, next) {
    let userId = req.params.userId;
    let loginId = req.user.loginId;
    let roomName = `${loginId}-${userId}`;
    db.query(`SELECT * FROM chatRoom WHERE roomName=?`, [roomName], function (err, roomCheck) {
      if (err) {
        throw `Error from /:userId/contact Router \n${err}`
      }
      // Checks Room Exist
      if (roomCheck[0] === undefined) {
        // Create Room
        db.query(`INSERT INTO chatRoom (roomName, chatReceiver, chatSender) VALUES (?,?,?)`, [roomName, userId, loginId])
        res.redirect(`/${loginId}/admin/contact`)
      } else {
        res.redirect(`/${loginId}/admin/contact`)
      }
    })
  });

  module.exports = router;